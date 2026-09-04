import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Blueprint, Corners } from '../components/Blueprint';
import { Nav } from '../components/Nav';
import { useStore } from '../lib/store';
import { useLocalProgress } from '../lib/useLocalProgress';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { CompanyLogo } from '../components/CompanyLogo';
import { ErrorState } from '../components/ErrorState';
import { api } from '../lib/api';
import { adaptCompany, adaptQuestionListItem } from '../lib/adapt';
import type { Company, QuestionListItem, RoleLevel } from '../lib/types';
import './CompanyDetail.css';

const ROLE_OPTS: Array<'All roles' | RoleLevel> = ['All roles', 'Intern', 'SDE-1', 'SDE-2', 'SDE-3', 'Senior'];
const ROUND_OPTS = ['Any round', 'OA', 'Phone', 'Tech', 'HR'] as const;
const DIFFICULTY_OPTS = ['All', 'Easy', 'Medium', 'Hard'] as const;

const LIST_PAGE_SIZE = 40;

// Debounce only the request, not the input: `search` is read straight from the
// URL so typing stays instant, and the fetch trails it.
const SEARCH_DEBOUNCE_MS = 250;

export default function CompanyDetail() {
  const { slug } = useParams();
  const { companies, loading: storeLoading, error: storeError, refresh } = useStore();
  const { isBookmarked, toggleBookmark, isSolved, toggleSolved } = useLocalProgress();
  const listCompany = companies.find((c) => c.slug === slug);

  // Filter state is mirrored to ?role=&round=&difficulty=&q= so a filtered
  // view is shareable — someone can paste "Google, Hard, dp" as one URL
  // and land on exactly that. Query params are the source of truth here;
  // the setters below just write to them and let the URL drive re-render.
  const [searchParams, setSearchParams] = useSearchParams();
  const roleFilter = (ROLE_OPTS as readonly string[]).includes(searchParams.get('role') ?? '')
    ? (searchParams.get('role') as (typeof ROLE_OPTS)[number])
    : 'All roles';
  const roundFilter = (ROUND_OPTS as readonly string[]).includes(searchParams.get('round') ?? '')
    ? (searchParams.get('round') as (typeof ROUND_OPTS)[number])
    : 'Any round';
  const difficultyFilter = (DIFFICULTY_OPTS as readonly string[]).includes(searchParams.get('difficulty') ?? '')
    ? (searchParams.get('difficulty') as (typeof DIFFICULTY_OPTS)[number])
    : 'All';
  const search = searchParams.get('q') ?? '';

  // Common setter shape: write the value into the URL when it's non-default,
  // strip the param when it IS the default so the URL stays clean.
  const updateParam = useCallback((key: string, value: string, defaultValue: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === defaultValue) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);
  const setRoleFilter = (v: (typeof ROLE_OPTS)[number]) => updateParam('role', v, 'All roles');
  const setRoundFilter = (v: (typeof ROUND_OPTS)[number]) => updateParam('round', v, 'Any round');
  const setDifficultyFilter = (v: (typeof DIFFICULTY_OPTS)[number]) => updateParam('difficulty', v, 'All');
  const setSearch = (v: string) => updateParam('q', v, '');

  // Trails `search` by a beat so a burst of typing is one request, not one per
  // character. The input itself is never gated on this.
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // The homepage's company list only carries questionCount (cheap to compute
  // for 427 companies at once) — fetch this one company's full stats
  // (contributors, most active role, etc.) separately.
  const [company, setCompany] = useState<Company | null>(null);

  // Rows, and the counts that describe the set they came from. Filtering,
  // sorting and paging all happen in Postgres now: the browser holds one page
  // of the columns this table renders, not every approved row for the company.
  const [rows, setRows] = useState<QuestionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalUnfiltered, setTotalUnfiltered] = useState(0);
  const [hasIndexed, setHasIndexed] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [questionsError, setQuestionsError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Bumped every time the filter set changes. loadMore captures the value it
  // started with and drops its page if that no longer matches, so a "Load
  // more" answered after the user has changed a filter cannot append rows
  // belonging to the previous filter onto the new list.
  const listGeneration = useRef(0);

  // Every non-default filter is sent. Deliberately not gated on hasIndexed:
  // that value only arrives with the first response, so keying the request on
  // it would make each page load fetch twice — once before it was known and
  // once after. hasIndexed decides which controls to render, nothing more, and
  // the UI only ever exposes one set at a time so the other stays at default.
  const activeFilters = useMemo(
    () => ({
      role: roleFilter === 'All roles' ? undefined : roleFilter,
      round: roundFilter === 'Any round' ? undefined : roundFilter,
      difficulty: difficultyFilter === 'All' ? undefined : difficultyFilter,
      q: debouncedSearch.trim() || undefined,
    }),
    [roleFilter, roundFilter, difficultyFilter, debouncedSearch],
  );

  // Header stats are filter-independent, so they get their own effect keyed on
  // the slug alone. Bundling them with the list meant every filter click and
  // every debounced keystroke re-ran three GROUP BY queries for numbers that
  // could not have changed.
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    api
      .company(slug)
      .then((apiCompany) => {
        if (!controller.signal.aborted) setCompany(adaptCompany(apiCompany));
      })
      .catch(() => {
        if (!controller.signal.aborted) setCompany(null);
      });
    return () => controller.abort();
  }, [slug, reloadKey]);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    listGeneration.current += 1;
    setLoadingQuestions(true);
    setLoadingMore(false);
    setQuestionsError(false);
    api
      .companyQuestions(slug, { ...activeFilters, limit: LIST_PAGE_SIZE, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setRows(page.items.map(adaptQuestionListItem));
        setTotal(page.total);
        setTotalUnfiltered(page.totalUnfiltered);
        setHasIndexed(page.hasIndexed);
      })
      .catch((e: unknown) => {
        // A superseded request (filter changed mid-flight) is not an error.
        if (controller.signal.aborted || (e instanceof Error && e.name === 'AbortError')) return;
        setQuestionsError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingQuestions(false);
      });
    return () => controller.abort();
  }, [slug, activeFilters, reloadKey]);

  // Append the next page. Offset is the number of rows already held, so it
  // stays correct however many pages deep the user has gone.
  const loadMore = useCallback(() => {
    if (!slug || loadingMore) return;
    const generation = listGeneration.current;
    const current = () => listGeneration.current === generation;
    setLoadingMore(true);
    api
      .companyQuestions(slug, { ...activeFilters, limit: LIST_PAGE_SIZE, offset: rows.length })
      .then((page) => {
        if (!current()) return;
        setRows((prev) => [...prev, ...page.items.map(adaptQuestionListItem)]);
        setTotal(page.total);
      })
      .catch(() => {
        if (current()) setQuestionsError(true);
      })
      .finally(() => {
        // When the generation moved on, the filter effect has already reset
        // this — writing false here would race it back on.
        if (current()) setLoadingMore(false);
      });
  }, [slug, activeFilters, rows.length, loadingMore]);

  useDocumentMeta(
    company ? `${company.name} Interview Questions — CrackList` : 'CrackList',
    company ? `${company.questionCount} real interview question${company.questionCount === 1 ? '' : 's'} asked at ${company.name}, shared by the community. Free, no signup.` : undefined,
  );

  if (!listCompany) {
    if (storeLoading) {
      return (
        <div className="page-shell">
          <Nav />
          <div style={{ padding: 60, opacity: 0.6, fontSize: 14 }}>Loading…</div>
        </div>
      );
    }
    if (storeError) {
      return (
        <div className="page-shell">
          <Nav />
          <div style={{ padding: 60, maxWidth: 480, margin: '0 auto' }}>
            <ErrorState onRetry={refresh} />
          </div>
        </div>
      );
    }
    return (
      <div className="page-shell">
        <Nav />
        <div style={{ padding: 60 }}>
          <p>Company not found.</p>
          <Link to="/" className="btn btn-secondary">← Back to browse</Link>
        </div>
      </div>
    );
  }

  const headerCompany = company ?? listCompany;

  return (
    <div className="page-shell">
      <Nav />

      <div className="company-header">
        <Blueprint style={{ width: 128, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CompanyLogo name={headerCompany.name} size={72} />
        </Blueprint>
        <div style={{ flex: 1 }}>
          <div className="kicker">Company · {companies.findIndex((c) => c.id === listCompany.id) + 1} of {companies.length}</div>
          <h1>{headerCompany.name}</h1>
          <div className="company-header-meta">
            <span><span style={{ color: 'var(--color-accent)' }}>{headerCompany.questionCount}</span> questions</span>
            <span><span style={{ color: 'var(--color-accent)' }}>{headerCompany.contributorCount}</span> contributors</span>
            <span>most recent · {headerCompany.mostRecent ?? '—'}</span>
            <span>most active · {headerCompany.mostActiveRole}</span>
          </div>
        </div>
        <Link to="/contribute" className="btn btn-primary blueprint" style={{ padding: '12px 22px' }}>
          Add a question
          <Corners />
        </Link>
      </div>

      {loadingQuestions && rows.length === 0 && totalUnfiltered === 0 ? (
        <div style={{ padding: 60, opacity: 0.6, fontSize: 14 }}>Loading questions…</div>
      ) : questionsError ? (
        <div style={{ padding: 60, maxWidth: 480, margin: '0 auto' }}>
          <ErrorState onRetry={() => setReloadKey((n) => n + 1)} />
        </div>
      ) : (
        <>
          {totalUnfiltered > 0 && (
            <div className="company-filters">
              <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.55 }}>Filter</div>
              {hasIndexed ? (
                <div className="seg">
                  {DIFFICULTY_OPTS.map((d) => (
                    <label className="seg-opt" key={d}>
                      <input type="radio" name="diff" hidden checked={difficultyFilter === d} onChange={() => setDifficultyFilter(d)} />
                      {d}
                    </label>
                  ))}
                </div>
              ) : (
                <>
                  <div className="seg">
                    {ROLE_OPTS.map((r) => (
                      <label className="seg-opt" key={r}>
                        <input type="radio" name="role" hidden checked={roleFilter === r} onChange={() => setRoleFilter(r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                  <div className="seg">
                    {ROUND_OPTS.map((r) => (
                      <label className="seg-opt" key={r}>
                        <input type="radio" name="rnd" hidden checked={roundFilter === r} onChange={() => setRoundFilter(r)} />
                        {r}
                      </label>
                    ))}
                  </div>
                </>
              )}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title or topic…"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-divider)',
                  color: 'inherit',
                  fontFamily: 'inherit',
                  padding: '8px 12px',
                  minWidth: 220,
                  marginLeft: 'auto',
                }}
              />
            </div>
          )}

          {totalUnfiltered > 0 ? (
            <div
              className="company-question-table-wrap"
              // Changing a filter refetches; dimming beats tearing the table
              // down and rebuilding it, which made every filter click flash.
              style={{ opacity: loadingQuestions ? 0.55 : 1, transition: 'opacity 120ms ease' }}
            >
              <div className="kicker" style={{ padding: '0 0 12px' }}>{total} of {totalUnfiltered} questions</div>
              <table className="company-question-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Title</th>
                    <th>{hasIndexed ? 'Difficulty' : 'Role · Round'}</th>
                    <th>Topics</th>
                    <th>{hasIndexed ? 'Frequency' : 'Asked'}</th>
                    <th title="How many people confirmed they were asked this">▲ Confirmed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((q, i) => (
                    <tr key={q.id} className={isSolved(q.id) ? 'solved' : ''}>
                      <td className="row-num">{i + 1}</td>
                      <td>
                        <Link to={`/q/${q.id}`} className="row-title">{q.title}</Link>
                      </td>
                      <td>
                        <span className={`tag ${q.difficulty ? `diff-${q.difficulty.toLowerCase()}` : 'tag-neutral'}`}>
                          {q.difficulty ?? `${q.roleLevel} · ${q.roundType}`}
                        </span>
                      </td>
                      <td className="row-topics">
                        {q.topicTags.slice(0, 3).map((t) => <span className="tag tag-accent" key={t}>{t}</span>)}
                        {q.topicTags.length > 3 && <span className="tag tag-neutral">+{q.topicTags.length - 3}</span>}
                      </td>
                      <td className="row-meta">{q.difficulty ? (q.frequency?.toFixed(1) ?? '—') : q.askedMonthYear}</td>
                      <td className="row-meta">{q.upvoteCount}</td>
                      <td className="row-actions">
                        <button
                          className={`bookmark-btn${isBookmarked(q.id) ? ' active' : ''}`}
                          onClick={() => toggleBookmark(q.id)}
                          title={isBookmarked(q.id) ? 'Remove bookmark (saved on this device)' : 'Bookmark (saved on this device)'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={isBookmarked(q.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                            <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                        <button
                          className={`solved-btn${isSolved(q.id) ? ' active' : ''}`}
                          onClick={() => toggleSolved(q.id)}
                          title={isSolved(q.id) ? 'Marked solved (on this device)' : 'Mark as solved (saved on this device)'}
                        >
                          ✓
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && !loadingQuestions && (
                <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>No questions match those filters.</div>
              )}
              {rows.length < total && (
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 16, padding: '10px 20px' }}
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : `Load ${Math.min(LIST_PAGE_SIZE, total - rows.length)} more`}
                </button>
              )}
            </div>
          ) : (
            <div className="graph-empty">
              <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 420 }}>
                No approved questions for {headerCompany.name} yet.
              </p>
              <Link to="/contribute" className="btn btn-primary blueprint" style={{ padding: '12px 22px' }}>
                Be the first to contribute
                <Corners />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
