import 'dotenv/config';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';

/**
 * Imports a bulk company-wise LeetCode question CSV (columns: Company,
 * Difficulty, Title, Frequency, Acceptance Rate, Link, Topics) into the
 * questions table as indexed/approved rows.
 *
 * Usage: npx tsx src/db/import-leetcode.ts [path/to/file.csv]
 * Defaults to src/db/data/All_Companies_Questions.csv.
 *
 * Safe to re-run: dedupes on (companyId, link) — the same LeetCode problem
 * can legitimately appear under many companies, but not twice under one.
 */

const prisma = new PrismaClient();

interface Row {
  Company: string;
  Difficulty: string;
  Title: string;
  Frequency: string;
  'Acceptance Rate': string;
  Link: string;
  Topics: string;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleCaseDifficulty(d: string): string {
  const s = d.trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function readRows(filePath: string): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row: Row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const filePath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), 'src/db/data/All_Companies_Questions.csv');

  if (!existsSync(filePath)) {
    console.error(`CSV not found at ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading ${filePath}...`);
  const rows = await readRows(filePath);
  console.log(`Parsed ${rows.length} rows.`);

  // ---- 1. Companies: dedupe by slug, upsert ----
  const companyNames = new Map<string, string>(); // slug -> display name (first seen)
  for (const r of rows) {
    const name = r.Company.trim();
    if (!name) continue;
    const slug = slugify(name);
    if (!companyNames.has(slug)) companyNames.set(slug, name);
  }
  console.log(`Upserting ${companyNames.size} companies...`);

  for (const batch of chunk([...companyNames.entries()], 100)) {
    await Promise.all(
      batch.map(([slug, name]) =>
        prisma.company.upsert({
          where: { normalizedSlug: slug },
          update: {},
          create: { id: slug, name, normalizedSlug: slug },
        }),
      ),
    );
  }

  // Map slug -> actual company id (existing seeded companies may have a
  // different id than their slug — look them up rather than assume id===slug).
  const companies = await prisma.company.findMany({
    where: { normalizedSlug: { in: [...companyNames.keys()] } },
    select: { id: true, normalizedSlug: true },
  });
  const slugToId = new Map(companies.map((c) => [c.normalizedSlug, c.id]));

  // ---- 2. Existing (companyId, link) pairs already in the DB, so re-runs skip them ----
  const existing = await prisma.question.findMany({
    where: { sourceType: 'indexed', link: { not: null } },
    select: { companyId: true, link: true },
  });
  const seen = new Set(existing.map((q) => `${q.companyId}::${q.link}`));

  // ---- 3. Build insert batch, dedupe within the file itself too ----
  type Insert = {
    companyId: string;
    roleLevel: string;
    roundType: string;
    questionText: string;
    topicTags: string[];
    difficulty: string;
    frequency: number | null;
    acceptanceRate: number | null;
    link: string;
    status: 'approved';
    sourceType: 'indexed';
    intakePath: null;
  };

  const toInsert: Insert[] = [];
  let skippedNoCompany = 0;
  let skippedDupe = 0;

  for (const r of rows) {
    const slug = slugify(r.Company);
    const companyId = slugToId.get(slug);
    if (!companyId) {
      skippedNoCompany++;
      continue;
    }
    const key = `${companyId}::${r.Link}`;
    if (seen.has(key)) {
      skippedDupe++;
      continue;
    }
    seen.add(key);

    const frequency = Number.parseFloat(r.Frequency);
    const acceptanceRate = Number.parseFloat(r['Acceptance Rate']);
    const topicTags = r.Topics
      ? r.Topics.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    toInsert.push({
      companyId,
      roleLevel: 'Other',
      roundType: 'Other',
      questionText: r.Title.trim(),
      topicTags,
      difficulty: titleCaseDifficulty(r.Difficulty),
      frequency: Number.isFinite(frequency) ? frequency : null,
      acceptanceRate: Number.isFinite(acceptanceRate) ? acceptanceRate : null,
      link: r.Link.trim(),
      status: 'approved',
      sourceType: 'indexed',
      intakePath: null,
    });
  }

  console.log(
    `Inserting ${toInsert.length} questions (skipped ${skippedDupe} already-imported, ${skippedNoCompany} missing company)...`,
  );

  let inserted = 0;
  for (const batch of chunk(toInsert, 500)) {
    const res = await prisma.question.createMany({ data: batch });
    inserted += res.count;
    process.stdout.write(`\r  ${inserted}/${toInsert.length}`);
  }
  console.log(`\nDone. Inserted ${inserted} questions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
