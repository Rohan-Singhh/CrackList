// Thin fetch wrapper around the Askd backend. All calls send cookies so the
// signed moderator session travels with /admin requests.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:4000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---- API response shapes (raw, backend-native) ----
export interface ApiCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  questionCount: number;
  contributorCount: number;
  mostActiveRole: string;
  mostRecent: string | null;
}

export interface ApiQuestion {
  id: string;
  companyId: string;
  roleLevel: string;
  roundType: string;
  questionText: string;
  codeSnippet: string | null;
  topicTags: string[];
  askedMonthYear: string | null;
  submittedBy: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason: string | null;
  sourceType: 'indexed' | 'community-submitted';
  sourceUrl: string | null;
  sourceLabel: string | null;
  intakePath: 'structured' | 'pdf-email' | null;
  upvoteCount: number;
  createdAt: string;
}

export interface ApiPdfSubmission {
  id: string;
  email: string;
  filename: string;
  note: string;
  createdAt: string;
}

export const api = {
  companies: () => req<ApiCompany[]>('/companies'),
  company: (slug: string) => req<ApiCompany>(`/companies/${slug}`),
  questions: (params: { companyId?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.companyId) q.set('companyId', params.companyId);
    if (params.status) q.set('status', params.status);
    const qs = q.toString();
    return req<ApiQuestion[]>(`/questions${qs ? `?${qs}` : ''}`);
  },
  question: (id: string) => req<ApiQuestion>(`/questions/${id}`),
  upvote: (id: string) => req<ApiQuestion>(`/questions/${id}/upvote`, { method: 'POST' }),
  confirm: (id: string, handle: string) =>
    req<ApiQuestion>(`/questions/${id}/confirm`, { method: 'POST', body: JSON.stringify({ handle }) }),
  stats: () => req<{ totalApproved: number; totalContributors: number }>('/stats'),

  submitStructured: (payload: Record<string, unknown>) =>
    req<ApiQuestion>('/submissions/structured', { method: 'POST', body: JSON.stringify(payload) }),
  submitPdf: (form: FormData) => req<ApiPdfSubmission>('/submissions/pdf', { method: 'POST', body: form }),

  // Admin / moderator
  login: (password: string) =>
    req<{ ok: boolean }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: boolean }>('/admin/logout', { method: 'POST' }),
  session: () => req<{ authenticated: boolean }>('/admin/session'),
  queue: () => req<ApiQuestion[]>('/admin/queue'),
  pdfInbox: () => req<ApiPdfSubmission[]>('/admin/pdf-inbox'),
  approve: (id: string) => req<ApiQuestion>(`/admin/questions/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason: string) =>
    req<ApiQuestion>(`/admin/questions/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
};
