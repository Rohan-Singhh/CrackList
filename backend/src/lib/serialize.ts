import type { Company, Question } from '@prisma/client';

// Prisma enum values use underscores (Postgres-safe); the API/PRD uses hyphens.
export function sourceTypeOut(v: string): 'indexed' | 'community-submitted' {
  return v === 'community_submitted' ? 'community-submitted' : 'indexed';
}
export function sourceTypeIn(v: string): 'indexed' | 'community_submitted' {
  return v === 'community-submitted' ? 'community_submitted' : 'indexed';
}
export function intakePathOut(v: string | null): 'structured' | 'pdf-email' | null {
  if (v === null) return null;
  return v === 'pdf_email' ? 'pdf-email' : 'structured';
}
export function intakePathIn(v: string | null): 'structured' | 'pdf_email' | null {
  if (v === null) return null;
  return v === 'pdf-email' ? 'pdf_email' : 'structured';
}

export function serializeQuestion(q: Question) {
  return {
    id: q.id,
    companyId: q.companyId,
    roleLevel: q.roleLevel,
    roundType: q.roundType,
    questionText: q.questionText,
    codeSnippet: q.codeSnippet,
    topicTags: q.topicTags,
    askedMonthYear: q.askedMonthYear,
    submittedBy: q.submittedByHandle,
    status: q.status,
    rejectionReason: q.rejectionReason,
    sourceType: sourceTypeOut(q.sourceType),
    sourceUrl: q.sourceUrl,
    sourceLabel: q.sourceLabel,
    intakePath: intakePathOut(q.intakePath),
    upvoteCount: q.upvoteCount,
    createdAt: q.createdAt.toISOString(),
  };
}

// Company stats (questionCount, contributorCount, mostRecent, mostActiveRole) are
// computed from approved questions, not stored columns — keeps the schema PRD-pure.
export function serializeCompany(
  c: Company,
  approved: Question[],
) {
  const mine = approved.filter((q) => q.companyId === c.id);
  const roleCounts = new Map<string, number>();
  for (const q of mine) roleCounts.set(q.roleLevel, (roleCounts.get(q.roleLevel) ?? 0) + 1);
  let mostActiveRole = 'Other';
  let top = -1;
  for (const [role, n] of roleCounts) if (n > top) { top = n; mostActiveRole = role; }
  const contributors = new Set(mine.map((q) => q.submittedByHandle ?? 'indexed'));
  const mostRecent = mine
    .map((q) => q.askedMonthYear)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    id: c.id,
    name: c.name,
    slug: c.normalizedSlug,
    logoUrl: c.logoUrl,
    questionCount: mine.length,
    contributorCount: contributors.size,
    mostActiveRole,
    mostRecent,
  };
}
