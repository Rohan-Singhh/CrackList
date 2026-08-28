export type RoleLevel = 'Intern' | 'SDE-1' | 'SDE-2' | 'SDE-3' | 'Senior' | 'Other';
export type RoundType = 'OA' | 'Phone screen' | 'Tech-1' | 'Tech-2' | 'Tech-3' | 'HR' | 'Other';
export type QuestionStatus = 'pending' | 'approved' | 'rejected';
export type SourceType = 'indexed' | 'community-submitted';
export type IntakePath = 'structured' | 'pdf-email';

export const REJECTION_REASONS = [
  'Duplicate question',
  'Not company-specific enough / too generic',
  'Missing key details',
  'Inappropriate / spam',
  'Other',
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export interface Company {
  id: string;
  slug: string;
  name: string;
  questionCount: number;
  contributorCount: number;
  mostRecent: string;
  mostActiveRole: RoleLevel;
  /** Graph layout position on the homepage hub graph, in the 0..1160 x 0..460 viewBox. */
  x: number;
  y: number;
  size: number;
  comingSoon?: boolean;
}

export interface Confirmer {
  handle: string;
  detail: string;
}

export interface Question {
  id: string;
  displayId: string;
  companyId: string;
  roleLevel: RoleLevel;
  roundType: RoundType;
  title: string;
  prompt: string;
  followUps: string[];
  codeSnippet?: string;
  topicTags: string[];
  cluster: string;
  askedMonthYear: string;
  /** Indexed-dataset fields (bulk company-wise LeetCode imports). Undefined for community questions. */
  difficulty?: string | null;
  frequency?: number | null;
  link?: string | null;
  perceivedEasy?: number;
  perceivedMedium?: number;
  perceivedHard?: number;
  submittedBy: string;
  status: QuestionStatus;
  rejectionReason: RejectionReason | null;
  sourceType: SourceType;
  sourceUrl: string;
  sourceLabel: string;
  intakePath: IntakePath | null;
  upvoteCount: number;
  confirmers: Confirmer[];
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  /** Position within its company's topic-cluster graph, in a 0..700 x 0..620 viewBox. */
  x: number;
  y: number;
  r: number;
}

export interface Submitter {
  handle: string;
  approvedCount: number;
  approvalRate: number;
}

export interface PdfSubmission {
  id: string;
  email: string;
  filename: string;
  note: string;
  hasFile?: boolean;
  createdAt: string;
}
