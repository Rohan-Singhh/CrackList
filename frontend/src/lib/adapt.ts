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

export function adaptCompany(c: ApiCompany): Company {
  const layout = COMPANY_LAYOUT[c.slug] ?? { x: 500, y: 230, size: 72 };
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    questionCount: c.questionCount,
    contributorCount: c.contributorCount,
    mostRecent: c.mostRecent ?? '—',
    mostActiveRole: (c.mostActiveRole as RoleLevel) ?? 'Other',
    x: layout.x,
    y: layout.y,
    size: layout.size,
    comingSoon: layout.comingSoon ?? c.questionCount === 0,
  };
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
