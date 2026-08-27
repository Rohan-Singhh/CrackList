import type { ApiCompany, ApiQuestion } from './api';
import type { Company, Question, RejectionReason, RoleLevel, RoundType } from './types';

// Homepage hub-graph positions are presentation-only and not stored in the DB.
// Keep the original hand-tuned layout keyed by slug so the homepage still reads
// as a designed graph.
const COMPANY_LAYOUT: Record<string, { x: number; y: number; size: number; comingSoon?: boolean }> = {
  google: { x: 210, y: 120, size: 92 },
  amazon: { x: 380, y: 90, size: 108 },
  microsoft: { x: 840, y: 110, size: 88 },
  meta: { x: 960, y: 200, size: 78 },
  stripe: { x: 910, y: 360, size: 84 },
  tcs: { x: 680, y: 400, size: 74 },
  infosys: { x: 360, y: 380, size: 80 },
  flipkart: { x: 160, y: 290, size: 76 },
  uber: { x: 580, y: 90, size: 62, comingSoon: true },
};

export const CURATED_COMPANY_SLUGS = new Set(Object.keys(COMPANY_LAYOUT));

// Companies without a hand-tuned position all used to collapse onto one fixed
// point (500, 230) once the real ~400-company dataset landed — every "extra"
// company rendered stacked on the same pixel. Give each a distinct fallback
// so at minimum nothing overlaps outright; homeGraphLayout() below is what
// actually keeps the rendered hub graph legible.
function fallbackPosition(slug: string): { x: number; y: number } {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  const angle = (hash % 360) * (Math.PI / 180);
  const radius = 120 + (hash % 90);
  return { x: 500 + Math.cos(angle) * radius, y: 230 + Math.sin(angle) * radius };
}

export function adaptCompany(c: ApiCompany): Company {
  const layout = COMPANY_LAYOUT[c.slug];
  const pos = layout ?? fallbackPosition(c.slug);
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    questionCount: c.questionCount,
    contributorCount: c.contributorCount,
    mostRecent: c.mostRecent ?? '—',
    mostActiveRole: (c.mostActiveRole as RoleLevel) ?? 'Other',
    x: pos.x,
    y: pos.y,
    size: layout?.size ?? 72,
    comingSoon: layout?.comingSoon ?? c.questionCount === 0,
  };
}

/**
 * Layout for the homepage hub graph: keeps the 9 hand-tuned curated
 * companies at their designed positions, and places the highest-volume
 * remaining companies (by question count) on an outer ring so the graph
 * stays legible instead of rendering all ~400+ companies as one blob.
 * Returns at most `cap` companies total.
 */
export function homeGraphLayout(companies: Company[], cap = 40): Company[] {
  const curated = companies.filter((c) => CURATED_COMPANY_SLUGS.has(c.slug));
  const rest = companies
    .filter((c) => !CURATED_COMPANY_SLUGS.has(c.slug))
    .sort((a, b) => b.questionCount - a.questionCount)
    .slice(0, Math.max(0, cap - curated.length));

  const cx = 580;
  const cy = 230;
  const rx = 540;
  const ry = 195;
  const ringed = rest.map((c, i) => {
    const angle = (i / Math.max(1, rest.length)) * Math.PI * 2;
    const maxCount = rest[0]?.questionCount || 1;
    const size = 40 + Math.round((c.questionCount / maxCount) * 30);
    return { ...c, x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry, size };
  });

  return [...curated, ...ringed];
}

function displayIdFor(id: string): string {
  const tail = id.slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `Q-${tail || '0000'}`;
}

export function adaptQuestion(q: ApiQuestion): Question {
  return {
    id: q.id,
    displayId: displayIdFor(q.id),
    companyId: q.companyId,
    roleLevel: q.roleLevel as RoleLevel,
    roundType: q.roundType as RoundType,
    title: q.questionText,
    prompt: q.questionText,
    followUps: [],
    codeSnippet: q.codeSnippet ?? undefined,
    topicTags: q.topicTags,
    cluster: q.topicTags[0] ?? 'general',
    askedMonthYear: q.askedMonthYear ?? '',
    difficulty: q.difficulty,
    frequency: q.frequency,
    acceptanceRate: q.acceptanceRate,
    link: q.link,
    submittedBy: q.submittedBy ?? 'indexed',
    status: q.status,
    rejectionReason: (q.rejectionReason as RejectionReason | null) ?? null,
    sourceType: q.sourceType,
    sourceUrl: q.sourceUrl ?? '',
    sourceLabel: q.sourceLabel ?? '',
    intakePath: q.intakePath,
    upvoteCount: q.upvoteCount,
    confirmers: [],
    createdAt: q.createdAt,
    // x/y/r are assigned per-company by layoutClusterGraph(); default off-graph.
    x: 0,
    y: 0,
    r: 9,
  };
}

/**
 * Deterministic topic-cluster layout for a company's question graph.
 * Groups questions by their primary cluster, places clusters on a grid, and
 * fans each cluster's nodes out radially. Coordinates target the CompanyDetail
 * 0..700 x 0..620 viewBox. No randomness — stable across renders.
 */
export function layoutClusterGraph(questions: Question[]): Question[] {
  const clusters = new Map<string, Question[]>();
  for (const q of questions) {
    const key = q.cluster || 'general';
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(q);
  }
  const keys = [...clusters.keys()].sort();
  const cols = Math.max(1, Math.ceil(Math.sqrt(keys.length)));
  const cellW = 700 / cols;
  const rows = Math.ceil(keys.length / cols);
  const cellH = 620 / Math.max(1, rows);

  const out: Question[] = [];
  keys.forEach((key, ci) => {
    const cx = (ci % cols) * cellW + cellW / 2;
    const cy = Math.floor(ci / cols) * cellH + cellH / 2;
    const nodes = clusters.get(key)!;
    nodes.forEach((q, ni) => {
      if (nodes.length === 1) {
        out.push({ ...q, x: cx, y: cy, r: nodeRadius(q) });
        return;
      }
      const angle = (ni / nodes.length) * Math.PI * 2;
      const radius = Math.min(cellW, cellH) * 0.32;
      out.push({
        ...q,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        r: nodeRadius(q),
      });
    });
  });
  return out;
}

function nodeRadius(q: Question): number {
  return Math.max(7, Math.min(12, 7 + Math.round(q.upvoteCount / 8)));
}
