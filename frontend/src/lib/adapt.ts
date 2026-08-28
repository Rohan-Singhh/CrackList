import type { ApiCompany, ApiQuestion } from './api';
import type { Company, Question, RejectionReason, RoleLevel, RoundType } from './types';

export function adaptCompany(c: ApiCompany): Company {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    questionCount: c.questionCount,
    contributorCount: c.contributorCount,
    mostRecent: c.mostRecent ?? '—',
    mostActiveRole: (c.mostActiveRole as RoleLevel) ?? 'Other',
    x: 0,
    y: 0,
    size: 0,
    comingSoon: c.questionCount === 0,
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
    x: 0,
    y: 0,
    r: 9,
  };
}
