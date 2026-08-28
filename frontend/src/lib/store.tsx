import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { adaptCompany, adaptQuestion } from './adapt';
import type { Company, PdfSubmission, Question, RejectionReason, RoleLevel, RoundType } from './types';

interface StructuredPayload {
  handle: string;
  companySlug: string;
  roleLevel: RoleLevel;
  roundType: RoundType;
  title: string;
  askedMonthYear: string;
  sourceUrl: string;
  tags: string[];
}

interface StoreValue {
  companies: Company[];
  questions: Question[];
  pdfInbox: PdfSubmission[];
  totalApprovedLifetime: number;
  totalContributors: number;
  loading: boolean;
  error: string | null;
  isModerator: boolean;

  upvoteQuestion: (id: string) => void;
  confirmQuestion: (id: string, handle: string, detail: string) => void;
  submitStructured: (payload: StructuredPayload) => void;
  submitPdf: (payload: { email: string; filename: string; note: string }) => void;
  approveQuestion: (id: string, moderator: string) => void;
  rejectQuestion: (id: string, reason: RejectionReason) => void;

  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pdfInbox, setPdfInbox] = useState<PdfSubmission[]>([]);
  const [totalApprovedLifetime, setTotalApproved] = useState(0);
  const [totalContributors, setTotalContributors] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModerator, setIsModerator] = useState(false);

  // ---- Public data (companies + stats only — NOT all approved questions).
  // At 17k+ questions, fetching the whole table on every load shipped ~9MB
  // and made /companies' naive JS aggregation take ~7s. Pages that need
  // questions now fetch their own scoped slice (CompanyDetail by companyId,
  // QuestionDetail by id, Homepage's recent/search via dedicated endpoints).
  const loadPublic = useCallback(async () => {
    const [apiCompanies, stats] = await Promise.all([api.companies(), api.stats()]);
    setCompanies(apiCompanies.map(adaptCompany));
    setTotalApproved(stats.totalApproved);
    setTotalContributors(stats.totalContributors);
  }, []);

  // ---- Moderator-only data (pending queue, PDF inbox) ----
  const loadModerator = useCallback(async () => {
    const [queue, inbox] = await Promise.all([api.queue(), api.pdfInbox()]);
    setQuestions((prev) => {
      const nonPending = prev.filter((q) => q.status !== 'pending');
      return [...queue.map(adaptQuestion), ...nonPending];
    });
    setPdfInbox(
      inbox.map((p) => ({ id: p.id, email: p.email, filename: p.filename, note: p.note, hasFile: p.hasFile, createdAt: p.createdAt })),
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      await loadPublic();
      if (isModerator) await loadModerator();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      throw e;
    }
  }, [loadPublic, loadModerator, isModerator]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { authenticated } = await api.session().catch(() => ({ authenticated: false }));
        if (!alive) return;
        setIsModerator(authenticated);
        await loadPublic();
        if (authenticated) await loadModerator();
        if (alive) setError(null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadPublic, loadModerator]);

  // ---- Actions (same names/signatures as the former mock store) ----

  const upvoteQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, upvoteCount: q.upvoteCount + 1 } : q)));
    api.upvote(id).catch(() => {
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, upvoteCount: q.upvoteCount - 1 } : q)));
    });
  }, []);

  const confirmQuestion = useCallback((id: string, handle: string, detail: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, upvoteCount: q.upvoteCount + 1, confirmers: [{ handle, detail }, ...q.confirmers] }
          : q,
      ),
    );
    api.confirm(id, handle).catch(() => undefined);
  }, []);

  const submitStructured = useCallback((payload: StructuredPayload) => {
    api
      .submitStructured({
        handle: payload.handle,
        companySlug: payload.companySlug,
        roleLevel: payload.roleLevel,
        roundType: payload.roundType,
        title: payload.title,
        askedMonthYear: payload.askedMonthYear,
        sourceUrl: payload.sourceUrl,
        tags: payload.tags,
      })
      .then((created) => {
        setQuestions((prev) => [adaptQuestion(created), ...prev]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Submission failed'));
  }, []);

  const submitPdf = useCallback((payload: { email: string; filename: string; note: string }) => {
    const form = new FormData();
    form.set('email', payload.email);
    form.set('note', payload.note);
    // Contribute's mock drop only yields a filename, not the File bytes; send a
    // placeholder blob under that name so the multipart upload pipeline runs.
    form.set('file', new Blob(['%PDF-1.4 placeholder'], { type: 'application/pdf' }), payload.filename);
    api
      .submitPdf(form)
      .then((created) => {
        setPdfInbox((prev) => [
          { id: created.id, email: created.email, filename: created.filename, note: created.note, createdAt: created.createdAt },
          ...prev,
        ]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Upload failed'));
  }, []);

  const approveQuestion = useCallback((id: string, _moderator: string) => {
    api
      .approve(id)
      .then(() => {
        setQuestions((prev) => {
          const target = prev.find((q) => q.id === id);
          const next = prev.map((q) => (q.id === id ? { ...q, status: 'approved' as const } : q));
          if (target) {
            setCompanies((cs) =>
              cs.map((c) => (c.id === target.companyId ? { ...c, questionCount: c.questionCount + 1 } : c)),
            );
          }
          return next;
        });
        setTotalApproved((n) => n + 1);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Approve failed'));
  }, []);

  const rejectQuestion = useCallback((id: string, reason: RejectionReason) => {
    api
      .reject(id, reason)
      .then(() => {
        setQuestions((prev) =>
          prev.map((q) => (q.id === id ? { ...q, status: 'rejected' as const, rejectionReason: reason } : q)),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Reject failed'));
  }, []);

  const login = useCallback(
    async (password: string) => {
      await api.login(password);
      setIsModerator(true);
      await loadModerator();
    },
    [loadModerator],
  );

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setIsModerator(false);
    setPdfInbox([]);
    setQuestions((prev) => prev.filter((q) => q.status !== 'pending'));
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      companies,
      questions,
      pdfInbox,
      totalApprovedLifetime,
      totalContributors,
      loading,
      error,
      isModerator,
      upvoteQuestion,
      confirmQuestion,
      submitStructured,
      submitPdf,
      approveQuestion,
      rejectQuestion,
      login,
      logout,
      refresh,
    }),
    [
      companies,
      questions,
      pdfInbox,
      totalApprovedLifetime,
      totalContributors,
      loading,
      error,
      isModerator,
      upvoteQuestion,
      confirmQuestion,
      submitStructured,
      submitPdf,
      approveQuestion,
      rejectQuestion,
      login,
      logout,
      refresh,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
