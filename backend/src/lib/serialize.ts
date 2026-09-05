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
    difficulty: q.difficulty,
    frequency: q.frequency,
    link: q.link,
    perceivedEasy: q.perceivedEasy,
    perceivedMedium: q.perceivedMedium,
    perceivedHard: q.perceivedHard,
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
// The caller passes aggregates rather than the rows themselves: at 17k+ questions,
// loading every approved row into Node just to count distinct handles meant the
// company page pulled its entire question set twice (once here, once for the list).
export interface CompanyStatsInput {
  questionCount: number;
  contributorHandles: Array<string | null>;
  roleCounts: Array<{ roleLevel: string; count: number }>;
  askedMonths: Array<string | null>;
}

export function serializeCompany(c: Company, stats: CompanyStatsInput) {
  let mostActiveRole = 'Other';
  let top = -1;
  for (const { roleLevel, count } of stats.roleCounts) {
    if (count > top) {
      top = count;
      mostActiveRole = roleLevel;
    }
  }
  const contributors = new Set(stats.contributorHandles.map((h) => h ?? 'indexed'));
  const mostRecent = stats.askedMonths.filter(Boolean).sort().at(-1) ?? null;

  return {
    id: c.id,
    name: c.name,
    slug: c.normalizedSlug,
    logoUrl: c.logoUrl,
    questionCount: stats.questionCount,
    contributorCount: stats.questionCount === 0 ? 0 : contributors.size,
    mostActiveRole,
    mostRecent,
  };
}

// The company question table renders only these fields. Selecting them in the
// query (instead of serializing whole rows) keeps a 40-row page small even
// though `questionText` and `codeSnippet` are the two fattest columns.
export const QUESTION_LIST_SELECT = {
  sourceType: true,
  id: true,
  roleLevel: true,
  roundType: true,
  questionText: true,
  topicTags: true,
  askedMonthYear: true,
  difficulty: true,
  frequency: true,
  upvoteCount: true,
} as const;

export type QuestionListRow = {
  sourceType: string;
  id: string;
  roleLevel: string;
  roundType: string;
  questionText: string;
  topicTags: string[];
  askedMonthYear: string | null;
  difficulty: string | null;
  frequency: number | null;
  upvoteCount: number;
};

export function serializeQuestionListItem(q: QuestionListRow) {
  return {
    sourceType: sourceTypeOut(q.sourceType),
    id: q.id,
    roleLevel: q.roleLevel,
    roundType: q.roundType,
    questionText: q.questionText,
    topicTags: q.topicTags,
    askedMonthYear: q.askedMonthYear,
    difficulty: q.difficulty,
    frequency: q.frequency,
    upvoteCount: q.upvoteCount,
  };
}
