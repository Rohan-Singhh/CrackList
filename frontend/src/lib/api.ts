// Thin fetch wrapper around the CrackList backend. All calls send cookies so the
// signed moderator session travels with /admin requests.
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:4000';
const BASE = API_BASE;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const jsonBody = !!init?.body && !(init.body instanceof FormData);
  const headers: Record<string, string> = {};
  if (jsonBody) headers['Content-Type'] = 'application/json';
  // Merge caller-provided headers on top so callers can add
  // Idempotency-Key etc. without fighting Content-Type.
  if (init?.headers) {
    const provided = new Headers(init.headers);
    provided.forEach((v, k) => { headers[k] = v; });
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
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
  difficulty: string | null;
  frequency: number | null;
  link: string | null;
  perceivedEasy: number;
  perceivedMedium: number;
  perceivedHard: number;
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
  hasFile?: boolean;
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
  voteDifficulty: (id: string, difficulty: 'Easy' | 'Medium' | 'Hard') =>
    req<ApiQuestion>(`/questions/${id}/difficulty-vote`, {
      method: 'POST',
      body: JSON.stringify({ difficulty }),
    }),
  stats: () => req<{ totalApproved: number; totalContributors: number }>('/stats'),
  trending: () => req<ApiQuestion[]>('/questions/trending'),
  recent: (limit = 6) => req<ApiQuestion[]>(`/questions/recent?limit=${limit}`),
  search: (query: string, opts: { role?: string; limit?: number } = {}) => {
    const q = new URLSearchParams({ q: query });
    if (opts.role) q.set('role', opts.role);
    if (opts.limit) q.set('limit', String(opts.limit));
    return req<ApiQuestion[]>(`/questions/search?${q.toString()}`);
  },

  submitStructured: (payload: Record<string, unknown>, idempotencyKey?: string) =>
    req<ApiQuestion>('/submissions/structured', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  submitPdf: (form: FormData, idempotencyKey?: string) =>
    req<ApiPdfSubmission>('/submissions/pdf', {
      method: 'POST',
      body: form,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  // Admin / moderator
  login: (password: string) =>
    req<{ ok: boolean }>('/admin/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => req<{ ok: boolean }>('/admin/logout', { method: 'POST' }),
  session: () => req<{ authenticated: boolean }>('/admin/session'),
  queue: () => req<ApiQuestion[]>('/admin/queue'),
  pdfInbox: () => req<ApiPdfSubmission[]>('/admin/pdf-inbox'),
  approve: (id: string, moderator?: string) =>
    req<ApiQuestion>(`/admin/questions/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ moderator }),
    }),
  reject: (id: string, reason: string, moderator?: string) =>
    req<ApiQuestion>(`/admin/questions/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason, moderator }),
    }),
  modActions: (limit = 50) => req<ApiModAction[]>(`/admin/mod-actions?limit=${limit}`),
};

export interface ApiModAction {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId: string;
  targetTitle: string | null;
  targetCompanyName: string | null;
  targetCompanySlug: string | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  reason: string | null;
  userAgent: string | null;
  createdAt: string;
}
