import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import {
  COMPANIES,
  INITIAL_PDF_INBOX,
  INITIAL_QUESTIONS,
  TOTAL_APPROVED_LIFETIME,
  TOTAL_CONTRIBUTORS,
  nextId,
} from './mockData';
import type { Company, PdfSubmission, Question, RejectionReason, RoleLevel, RoundType } from './types';

interface State {
  companies: Company[];
  questions: Question[];
  pdfInbox: PdfSubmission[];
  totalApprovedLifetime: number;
  totalContributors: number;
}

type Action =
  | { type: 'upvote'; id: string }
  | { type: 'confirm'; id: string; handle: string; detail: string }
  | {
      type: 'submitStructured';
      payload: {
        handle: string;
        companySlug: string;
        roleLevel: RoleLevel;
        roundType: RoundType;
        title: string;
        askedMonthYear: string;
        sourceUrl: string;
        tags: string[];
      };
    }
  | { type: 'submitPdf'; payload: { email: string; filename: string; note: string } }
  | { type: 'approve'; id: string; moderator: string }
  | { type: 'reject'; id: string; reason: RejectionReason };

const initialState: State = {
  companies: COMPANIES,
  questions: INITIAL_QUESTIONS,
  pdfInbox: INITIAL_PDF_INBOX,
  totalApprovedLifetime: TOTAL_APPROVED_LIFETIME,
  totalContributors: TOTAL_CONTRIBUTORS,
};

function today() {
  return new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'upvote':
      return {
        ...state,
        questions: state.questions.map((q) => (q.id === action.id ? { ...q, upvoteCount: q.upvoteCount + 1 } : q)),
      };
    case 'confirm':
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.id
            ? { ...q, upvoteCount: q.upvoteCount + 1, confirmers: [{ handle: action.handle, detail: action.detail }, ...q.confirmers] }
            : q,
        ),
      };
    case 'submitStructured': {
      const { handle, companySlug, roleLevel, roundType, title, askedMonthYear, sourceUrl, tags } = action.payload;
      const company = state.companies.find((c) => c.slug === companySlug);
      const newQuestion: Question = {
        id: `q-${nextId()}`,
        displayId: `Q-${3421 + state.questions.filter((q) => q.status === 'pending').length + 1}`,
        companyId: company?.id ?? companySlug,
        roleLevel,
        roundType,
        title,
        prompt: title,
        followUps: [],
        topicTags: tags,
        cluster: tags[0] ?? 'general',
        askedMonthYear,
        submittedBy: handle,
        status: 'pending',
        rejectionReason: null,
        sourceType: 'community-submitted',
        sourceUrl,
        sourceLabel: 'via community submission',
        intakePath: 'structured',
        upvoteCount: 0,
        confirmers: [],
        createdAt: today(),
        x: 0,
        y: 0,
        r: 9,
      };
      return { ...state, questions: [newQuestion, ...state.questions] };
    }
    case 'submitPdf': {
      const submission: PdfSubmission = {
        id: `pdf-${nextId()}`,
        email: action.payload.email,
        filename: action.payload.filename,
        note: action.payload.note,
        createdAt: today(),
      };
      return { ...state, pdfInbox: [submission, ...state.pdfInbox] };
    }
    case 'approve': {
      const target = state.questions.find((q) => q.id === action.id);
      if (!target) return state;
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.id ? { ...q, status: 'approved', approvedAt: today(), approvedBy: action.moderator } : q,
        ),
        companies: state.companies.map((c) =>
          c.id === target.companyId ? { ...c, questionCount: c.questionCount + 1 } : c,
        ),
        totalApprovedLifetime: state.totalApprovedLifetime + 1,
      };
    }
    case 'reject':
      return {
        ...state,
        questions: state.questions.map((q) =>
          q.id === action.id ? { ...q, status: 'rejected', rejectionReason: action.reason } : q,
        ),
      };
    default:
      return state;
  }
}

interface StoreValue extends State {
  upvoteQuestion: (id: string) => void;
  confirmQuestion: (id: string, handle: string, detail: string) => void;
  submitStructured: (payload: Extract<Action, { type: 'submitStructured' }>['payload']) => void;
  submitPdf: (payload: Extract<Action, { type: 'submitPdf' }>['payload']) => void;
  approveQuestion: (id: string, moderator: string) => void;
  rejectQuestion: (id: string, reason: RejectionReason) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const upvoteQuestion = useCallback((id: string) => dispatch({ type: 'upvote', id }), []);
  const confirmQuestion = useCallback(
    (id: string, handle: string, detail: string) => dispatch({ type: 'confirm', id, handle, detail }),
    [],
  );
  const submitStructured = useCallback(
    (payload: Extract<Action, { type: 'submitStructured' }>['payload']) => dispatch({ type: 'submitStructured', payload }),
    [],
  );
  const submitPdf = useCallback(
    (payload: Extract<Action, { type: 'submitPdf' }>['payload']) => dispatch({ type: 'submitPdf', payload }),
    [],
  );
  const approveQuestion = useCallback((id: string, moderator: string) => dispatch({ type: 'approve', id, moderator }), []);
  const rejectQuestion = useCallback((id: string, reason: RejectionReason) => dispatch({ type: 'reject', id, reason }), []);

  const value = useMemo<StoreValue>(
    () => ({ ...state, upvoteQuestion, confirmQuestion, submitStructured, submitPdf, approveQuestion, rejectQuestion }),
    [state, upvoteQuestion, confirmQuestion, submitStructured, submitPdf, approveQuestion, rejectQuestion],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
