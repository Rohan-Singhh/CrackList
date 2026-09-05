import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Nav } from '../components/Nav';
import { CompanyLogo } from '../components/CompanyLogo';
import { ErrorState } from '../components/ErrorState';
import { useStore } from '../lib/store';
import { useLocalProgress } from '../lib/useLocalProgress';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { api } from '../lib/api';
import { rememberCompany } from '../lib/recentCompanies';
import { adaptCompany, adaptQuestionListItem } from '../lib/adapt';
import type { Company, QuestionListItem } from '../lib/types';
import './CompanyDetail.css';

const PAGE_SIZE = 40;
const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const ROLES = ['All roles', 'Intern', 'SDE-1', 'SDE-2', 'SDE-3', 'Senior'];
const ROUNDS = ['Any round', 'OA', 'Phone', 'Tech', 'HR'];
const VIEWS = ['all', 'saved', 'solved'] as const;

export default function CompanyDetail() {
  const { slug = '' } = useParams();
  const { companies, loading: storeLoading, error: storeError, refresh } = useStore();
  const { bookmarkedIds, solvedIds, isBookmarked, isSolved, toggleBookmark, toggleSolved } =
    useLocalProgress();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const difficulty = DIFFICULTIES.includes(params.get('difficulty') ?? '')
    ? params.get('difficulty')!
    : 'All';
  const role = ROLES.includes(params.get('role') ?? '') ? params.get('role')! : 'All roles';
  const round = ROUNDS.includes(params.get('round') ?? '') ? params.get('round')! : 'Any round';
  const view = VIEWS.find((value) => value === params.get('view')) ?? 'all';
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [company, setCompany] = useState<Company | null>(null);
  const [rows, setRows] = useState<QuestionListItem[]>([]);
  const [total, setTotal] = useState(0);

  const [hasIndexed, setHasIndexed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [reload, setReload] = useState(0);
  const [scope, setScope] = useState<{ slug: string; ids: string[] } | null>(null);
  const [progressError, setProgressError] = useState(false);
  const generation = useRef(0);
  const moreController = useRef<AbortController | null>(null);
  const firstPageKey = useRef('');

  const updateParam = (key: string, value: string, defaultValue = '') => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value === defaultValue) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  const clearFilters = () => setParams(view === 'all' ? {} : { view }, { replace: true });
  const hasFilters = Boolean(search || difficulty !== 'All' || role !== 'All roles' || round !== 'Any round');
  const selectedIds = useMemo(
    () => (view === 'saved' ? [...bookmarkedIds] : view === 'solved' ? [...solvedIds] : undefined),
    [view, bookmarkedIds, solvedIds],
  );
  const filters = useMemo(
    () => ({
      q: debouncedSearch.trim() || undefined,
      difficulty: difficulty === 'All' ? undefined : difficulty,
      role: role === 'All roles' ? undefined : role,
      round: round === 'Any round' ? undefined : round,
      ids: selectedIds,
    }),
    [debouncedSearch, difficulty, role, round, selectedIds],
  );
  const queryKey = JSON.stringify([slug, filters, reload]);
  const [loadedKey, setLoadedKey] = useState('');
  const pending = loading || loadedKey !== queryKey || search !== debouncedSearch;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let alive = true;
    api
      .company(slug)
      .then((value) => {
        if (alive) setCompany(adaptCompany(value));
      })
      .catch(() => {
        if (alive) setCompany(null);
      });
    return () => {
      alive = false;
    };
  }, [slug, reload]);

  useEffect(() => {
    const controller = new AbortController();
    setProgressError(false);
    const ids = [...new Set([...bookmarkedIds, ...solvedIds])];
    if (!ids.length) {
      setScope({ slug, ids: [] });
    } else {
      api
        .companyProgress(slug, ids, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setScope({ slug, ids: value.ids });
        })
        .catch(() => {
          if (!controller.signal.aborted) setProgressError(true);
        });
    }
    return () => controller.abort();
  }, [slug, bookmarkedIds, solvedIds, reload]);

  useEffect(() => {
    const controller = new AbortController();
    generation.current += 1;
    moreController.current?.abort();
    firstPageKey.current = '';
    setLoading(true);
    setLoadingMore(false);
    setError(false);
    setMoreError(false);
    api
      .companyQuestions(slug, { ...filters, limit: PAGE_SIZE, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setRows(page.items.map(adaptQuestionListItem));
        setTotal(page.total);

        setHasIndexed(page.hasIndexed);
        firstPageKey.current = queryKey;
        setLoadedKey(queryKey);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      moreController.current?.abort();
    };
  }, [slug, filters, queryKey]);

  const loadMore = useCallback(() => {
    if (pending || moreController.current || firstPageKey.current !== queryKey) return;
    const controller = new AbortController();
    const started = generation.current;
    moreController.current = controller;
    setLoadingMore(true);
    setMoreError(false);
    api
      .companyQuestions(slug, {
        ...filters,
        offset: rows.length,
        limit: PAGE_SIZE,
        signal: controller.signal,
      })
      .then((page) => {
        if (controller.signal.aborted || started !== generation.current) return;
        setRows((previous) => {
          const existing = new Set(previous.map((row) => row.id));
          return [
            ...previous,
            ...page.items.filter((row) => !existing.has(row.id)).map(adaptQuestionListItem),
          ];
        });
        setTotal(page.total);
      })
      .catch(() => {
        if (!controller.signal.aborted && started === generation.current) setMoreError(true);
      })
      .finally(() => {
        if (moreController.current === controller) moreController.current = null;
        if (!controller.signal.aborted && started === generation.current) setLoadingMore(false);
      });
  }, [pending, queryKey, slug, filters, rows.length]);

  const header = company?.slug === slug ? company : companies.find((item) => item.slug === slug);
  useEffect(() => {
    if (header) rememberCompany(header.slug);
  }, [header]);
  const scopedIds = scope?.slug === slug ? scope.ids : [];
  const solved = scopedIds.filter((id) => solvedIds.has(id)).length;
  const saved = scopedIds.filter((id) => bookmarkedIds.has(id)).length;
  const progressReady = scope?.slug === slug && !progressError;
  const questionCount = header?.questionCount ?? 0;
  const percent = questionCount ? Math.min(100, Math.round((solved / questionCount) * 100)) : 0;
  const nextQuestion = rows.find((row) => !isSolved(row.id));
  const practiceState = { companySearch: params.toString(), practiceQueue: rows.map((row) => row.id) };
  useDocumentMeta(
    header ? `${header.name} Interview Questions — CrackList` : 'CrackList',
    header
      ? `Prepare for ${header.name} with company-tagged questions, source details, and your own saved practice list.`
      : undefined,
  );

  if (!header)
    return (
      <div className="page-shell">
        <Nav />
        <main className="company-state">
          {storeLoading ? (
            <p role="status">Loading company…</p>
          ) : storeError ? (
            <ErrorState onRetry={refresh} />
          ) : (
            <>
              <h1>Company not found</h1>
              <Link to="/">Back to companies</Link>
            </>
          )}
        </main>
      </div>
    );

  return (
    <div className="page-shell company-page">
      <Nav />
      <main className="company-workspace">
        <nav className="company-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">← All companies</Link>
          <span>/</span>
          <span>{header.name}</span>
        </nav>
        <header className="company-overview">
          <div className="company-intro">
            <div className="company-eyebrow">
              <span className="company-mark">
                <CompanyLogo key={slug} name={header.name} size={30} />
              </span>
              <span>THE COMPANY NOTEBOOK</span>
            </div>
            <h1>
              Prepare for <span>{header.name}.</span>
            </h1>
            <p>
              Know the questions. Work through the patterns.
              <br />
              Build a little more confidence with every solve.
            </p>
            <div className="company-facts">
              <span>
                <strong>{questionCount.toLocaleString()}</strong> questions
              </span>
              <span>Free to explore</span>
              <Link to="/contribute">Share an interview question ↗</Link>
            </div>
          </div>
          <aside className="company-progress" aria-label="Your preparation progress">
            <div className="progress-heading">
              <span className="kicker">Your preparation</span>
              <span className="progress-device">On this device</span>
            </div>
            <div className="progress-number">
              <strong>{progressReady ? solved : '—'}</strong>
              <span> / {questionCount.toLocaleString()} solved</span>
            </div>
            <progress
              value={progressReady ? solved : 0}
              max={Math.max(questionCount, 1)}
              aria-label="Company questions solved"
            />
            <div className="progress-caption">
              <span>
                {progressReady
                  ? `${percent}% complete`
                  : progressError
                    ? 'Progress unavailable'
                    : 'Loading progress…'}
              </span>
              <span>{progressReady ? `${saved} saved for later` : ''}</span>
            </div>
            {!pending && nextQuestion ? (
              <Link className="company-primary" to={`/q/${nextQuestion.id}`} state={practiceState}>
                {solved ? 'Keep practicing' : 'Start practicing'} <span>↗</span>
              </Link>
            ) : (
              <a className="company-primary" href="#question-library">
                Explore questions <span>↓</span>
              </a>
            )}
            {progressError && (
              <button className="company-text-button" onClick={() => setReload((value) => value + 1)}>
                Retry progress
              </button>
            )}
          </aside>
        </header>

        <section className="company-library" id="question-library" aria-labelledby="library-heading">
          <div className="library-heading">
            <div>
              <div className="kicker">A little practice, every day</div>
              <h2 id="library-heading">Your question library</h2>
            </div>
            <p>Save what matters. Tick off what you know.</p>
          </div>
          <div className="library-tabs" role="group" aria-label="Question view">
            {VIEWS.map((value) => (
              <button
                key={value}
                aria-pressed={view === value}
                onClick={() => updateParam('view', value, 'all')}
              >
                {value === 'all' ? 'All questions' : value === 'saved' ? 'Saved' : 'Solved'}
                <span>
                  {value === 'all'
                    ? questionCount.toLocaleString()
                    : progressReady
                      ? value === 'saved'
                        ? saved
                        : solved
                      : '—'}
                </span>
              </button>
            ))}
          </div>
          <div className="library-filters">
            <label className="library-search">
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                aria-label="Search title or topic"
                value={search}
                placeholder="Search a question or topic…"
                onChange={(event) => updateParam('q', event.target.value)}
              />
              {search && (
                <button aria-label="Clear search" onClick={() => updateParam('q', '')}>
                  ×
                </button>
              )}
            </label>
            {(hasIndexed || difficulty !== 'All') && (
              <div className="difficulty-filter" role="group" aria-label="Difficulty">
                {DIFFICULTIES.map((value) => (
                  <button
                    key={value}
                    aria-pressed={difficulty === value}
                    onClick={() => updateParam('difficulty', value, 'All')}
                  >
                    {value}
                  </button>
                ))}
              </div>
            )}
            {(!hasIndexed || role !== 'All roles' || round !== 'Any round') && (
              <>
                <select
                  aria-label="Role"
                  value={role}
                  onChange={(event) => updateParam('role', event.target.value, 'All roles')}
                >
                  {ROLES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
                <select
                  aria-label="Round"
                  value={round}
                  onChange={(event) => updateParam('round', event.target.value, 'Any round')}
                >
                  {ROUNDS.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </>
            )}
            {hasFilters && (
              <button className="company-text-button" onClick={clearFilters}>
                Reset filters
              </button>
            )}
          </div>
          <div className="library-results-meta" role="status">
            <span>
              {error
                ? 'Questions could not be loaded'
                : pending
                  ? 'Updating questions…'
                  : `${total.toLocaleString()} ${total === 1 ? 'question' : 'questions'}${hasFilters ? ' match your filters' : view === 'all' ? ' to explore' : ` ${view}`}`}
            </span>
            <span>Newest first</span>
          </div>
          {error ? (
            <div className="company-state">
              <ErrorState onRetry={() => setReload((value) => value + 1)} />
            </div>
          ) : (
            <div className={`library-results${pending ? ' is-pending' : ''}`} aria-busy={pending} inert={pending}>
              {rows.length > 0 && (
                <table className="practice-table">
                  <thead>
                    <tr>
                      <th scope="col" className="practice-status">
                        Done
                      </th>
                      <th scope="col">Question</th>
                      <th scope="col">Difficulty / round</th>
                      <th scope="col" className="practice-confirmations">
                        Confirmations
                      </th>
                      <th scope="col">Save</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((question) => (
                      <tr key={question.id} className={isSolved(question.id) ? 'is-solved' : ''}>
                        <td className="practice-status">
                          <button
                            className="practice-check"
                            aria-label={`${isSolved(question.id) ? 'Mark unsolved' : 'Mark solved'}: ${question.title}`}
                            aria-pressed={isSolved(question.id)}
                            disabled={pending}
                            onClick={() => toggleSolved(question.id)}
                          >
                            {isSolved(question.id) ? '✓' : <span />}
                          </button>
                        </td>
                        <td className="practice-question">
                          <Link to={`/q/${question.id}`} state={practiceState}>
                            {question.title}
                          </Link>
                          <div className="practice-topics">
                            {question.topicTags.slice(0, 3).map((topic) => (
                              <button key={topic} onClick={() => updateParam('q', topic)}>
                                {topic}
                              </button>
                            ))}
                            {question.topicTags.length > 3 && (
                              <span title={question.topicTags.slice(3).join(', ')}>
                                +{question.topicTags.length - 3}
                              </span>
                            )}
                          </div>
                          <span className="practice-source">
                            {question.sourceType === 'indexed' ? 'Indexed problem' : question.sourceType === 'community-submitted' ? 'Community report' : 'Source unavailable'}
                            {question.askedMonthYear && ` · ${question.askedMonthYear}`}
                          </span>
                        </td>
                        <td className="practice-difficulty">
                          <span
                            className={`difficulty-label ${question.difficulty?.toLowerCase() ?? 'community'}`}
                          >
                            {question.difficulty ?? question.roundType}
                          </span>
                          {!question.difficulty && <small>{question.roleLevel}</small>}
                        </td>
                        <td className="practice-confirmations">
                          <span title="Community confirmations; not independently verified">
                            {question.upvoteCount > 0 ? question.upvoteCount : '—'}
                          </span>
                        </td>
                        <td>
                          <button
                            className="practice-save"
                            aria-label={`${isBookmarked(question.id) ? 'Unsave' : 'Save'}: ${question.title}`}
                            aria-pressed={isBookmarked(question.id)}
                            disabled={pending}
                            onClick={() => toggleBookmark(question.id)}
                          >
                            <svg
                              aria-hidden="true"
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill={isBookmarked(question.id) ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              strokeWidth="1.5"
                            >
                              <path d="M6 4h12v17l-6-4-6 4z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!rows.length && (
                <div className="library-empty">
                  {pending ? (
                    <>
                      <div className="library-loading-line" />
                      <p>Getting your questions ready…</p>
                    </>
                  ) : (
                    <>
                      <span className="empty-symbol" aria-hidden="true">
                        {view === 'solved' ? '✓' : view === 'saved' ? '◇' : '⌕'}
                      </span>
                      <h3>
                        {hasFilters
                          ? 'Nothing matches just yet.'
                          : view === 'saved'
                            ? 'Make this list your own.'
                            : view === 'solved'
                              ? 'Your first solve starts here.'
                              : 'A fresh page in the notebook.'}
                      </h3>
                      <p>
                        {hasFilters
                          ? 'Try a broader search or reset your filters.'
                          : view === 'saved'
                            ? 'Save a question from the library. It will be waiting here.'
                            : view === 'solved'
                              ? 'Mark a question as solved to keep track of your practice.'
                              : 'No approved questions for this company yet. Share one from your interview.'}
                      </p>
                      {hasFilters ? (
                        <button className="company-text-button" onClick={clearFilters}>
                          Reset filters →
                        </button>
                      ) : view !== 'all' ? (
                        <button
                          className="company-text-button"
                          onClick={() => updateParam('view', 'all', 'all')}
                        >
                          Explore all questions →
                        </button>
                      ) : (
                        <Link to="/contribute">Contribute a question →</Link>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {!error && rows.length > 0 && (
            <div className="library-pagination">
              <span>{pending ? 'Updating…' : `Showing ${rows.length} of ${total.toLocaleString()}`}</span>
              {moreError && <span role="alert">Couldn’t load the next page. Try again.</span>}
              {rows.length < total && (
                <button onClick={loadMore} disabled={pending || loadingMore}>
                  {loadingMore ? 'Loading…' : moreError ? 'Retry loading more' : 'Load more questions'}{' '}
                  <span aria-hidden="true">↓</span>
                </button>
              )}
            </div>
          )}
        </section>
        <footer className="company-footnote">
          <span>Built from shared experience.</span>
          <p>
            Indexed problems and community reports are labeled individually. Company tags aren’t a guarantee
            of what you’ll be asked.
          </p>
          <Link to="/about">About the index ↗</Link>
        </footer>
      </main>
    </div>
  );
}
