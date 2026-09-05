import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Corners } from '../components/Blueprint';
import { Nav } from '../components/Nav';
import { CompanyLogo } from '../components/CompanyLogo';
import { ErrorState } from '../components/ErrorState';
import { useStore } from '../lib/store';
import { useLocalProgress } from '../lib/useLocalProgress';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { adaptQuestion } from '../lib/adapt';
import { api } from '../lib/api';
import { recentCompanySlugs } from '../lib/recentCompanies';
import type { Question } from '../lib/types';
import { smoothScrollTo, staggerDelay } from '../lib/motion';
import './Homepage.css';

const ROLE_FILTERS = ['All', 'Intern', 'SDE-1', 'SDE-2+'] as const;

const SUGGESTION_LIMIT = 8;
const RESULTS_PAGE_SIZE = 60;
// The company grid is one remote logo request per tile; rendering all 400+
// at once meant 400+ image fetches competing with the page's own data.
const COMPANY_PAGE_SIZE = 60;

const ROLE_TO_API: Record<(typeof ROLE_FILTERS)[number], string | undefined> = {
  All: undefined,
  Intern: 'Intern',
  'SDE-1': 'SDE-1',
  'SDE-2+': 'SDE-2,SDE-3,Senior',
};

export default function Homepage() {
  const { companies, totalApprovedLifetime, totalContributors, loading: storeLoading, error: storeError, refresh } = useStore();
  const { isBookmarked, toggleBookmark, solvedCount, bookmarkedCount } = useLocalProgress();
  const [recentSlugs] = useState(recentCompanySlugs);
  const recentCompanies = recentSlugs.map((slug) => companies.find((company) => company.slug === slug)).filter((company) => company !== undefined);
  const navigate = useNavigate();
  useDocumentMeta(
    'CrackList — Free Interview Questions by Company',
    'Free, community-run database of real interview questions asked at hundreds of companies. No signup, no paywall.',
  );
  const blurTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(blurTimer.current), []);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [focused, setFocused] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(RESULTS_PAGE_SIZE);
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>('All');
  const [trending, setTrending] = useState<Question[]>([]);
  const [trendingLoaded, setTrendingLoaded] = useState(false);
  const [trendingError, setTrendingError] = useState(false);
  const [recentlyApproved, setRecentlyApproved] = useState<Question[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);
  const [recentError, setRecentError] = useState(false);

  // Search now hits the backend (GET /questions/search) instead of filtering
  // a client-held copy of all 17k+ approved questions — that used to mean
  // shipping the entire table to the browser just to power a search box.
  const [searchResults, setSearchResults] = useState<Question[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);

  const loadRecent = useCallback(() => {
    setRecentError(false);
    setTrendingError(false);
    api
      .trending()
      .then((data) => setTrending(data.map(adaptQuestion)))
      .catch(() => setTrendingError(true))
      .finally(() => setTrendingLoaded(true));
    api
      .recent(6)
      .then((data) => {
        setRecentlyApproved(data.map(adaptQuestion));
      })
      .catch(() => setRecentError(true))
      .finally(() => setRecentLoaded(true));
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const runSearch = useCallback(
    (q: string, signal?: AbortSignal) => {
      setSearching(true);
      setSearchError(false);
      api
        .search(q, { role: ROLE_TO_API[roleFilter], limit: 200, signal })
        .then((data) => {
          if (signal?.aborted) return;
          setSearchResults(data.map(adaptQuestion));
        })
        .catch((e: unknown) => {
          // An aborted request was superseded by a newer keystroke, so its
          // result is stale by definition — it must not touch state at all,
          // or a slow early response lands on top of a fast later one.
          if (signal?.aborted || (e instanceof Error && e.name === 'AbortError')) return;
          setSearchResults(null);
          setSearchError(true);
        })
        .finally(() => {
          if (!signal?.aborted) setSearching(false);
        });
    },
    [roleFilter],
  );

  // Debounce so search fires ~10x/sec of typing, not on every keystroke —
  // the input itself stays instant (bound to `query`).
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setDebouncedQuery('');
      setSearchResults(null);
      setSearchError(false);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      setDebouncedQuery(q);
      runSearch(q, controller.signal);
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, roleFilter, runSearch]);

  const retrySearch = useCallback(() => {
    if (!debouncedQuery) return;
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const companiesById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);

  // Live typeahead: a small slice for the dropdown, not the full result set —
  // keeps every keystroke cheap to render regardless of how many matches exist.
  const suggestions = useMemo(() => searchResults?.slice(0, SUGGESTION_LIMIT) ?? [], [searchResults]);
  const showDropdown = focused && !submitted && debouncedQuery.length > 0;

  useEffect(() => {
    setResultsVisible(RESULTS_PAGE_SIZE);
  }, [debouncedQuery]);

  const cardsToShow = (submitted ? searchResults : null) ?? recentlyApproved;

  const [companySearch, setCompanySearch] = useState('');
  const [companiesVisible, setCompaniesVisible] = useState(COMPANY_PAGE_SIZE);
  const sortedCompanies = useMemo(() => [...companies].sort((a, b) => b.questionCount - a.questionCount), [companies]);
  const gridCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return sortedCompanies;
    return sortedCompanies.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedCompanies, companySearch]);

  // A new filter is a new list — start it from the top rather than leaving the
  // previous "load more" depth applied to a completely different set.
  useEffect(() => {
    setCompaniesVisible(COMPANY_PAGE_SIZE);
  }, [companySearch]);

  // Scroll to #trending if the URL hash is set (e.g. from nav click on another page).
  useEffect(() => {
    if (window.location.hash === '#trending') {
      setTimeout(() => {
        smoothScrollTo(document.getElementById('trending'));
      }, 300);
    }
  }, []);

  return (
    <div className="page-shell">
      <Nav />

      <div className="home-hero">
        <div>
          <div className="kicker" style={{ marginBottom: 20 }}>The interview preparation notebook</div>
          <h1>
            Your next interview.
            <br />
            <span style={{ color: '#294a68' }}>A little more prepared.</span>
          </h1>
          <p>
            Explore company-tagged problems and interview reports. Build your practice list,
            work through the patterns, and keep track of what you’ve learned. Free, with no signup.
          </p>
          <div className="home-hero-actions">
            <a
              href="#companies"
              className="btn btn-primary blueprint"
              style={{ padding: '12px 22px', fontSize: 14 }}
              onClick={(e) => {
                e.preventDefault();
                smoothScrollTo(document.getElementById('companies'));
              }}
            >
              Find your company
              <Corners />
            </a>
            <Link to="/contribute" className="btn btn-secondary" style={{ padding: '12px 22px', fontSize: 14 }}>
              Contribute a question
            </Link>
          </div>
        </div>

        <div className="home-hero-stats">
          <div className="stat"><div className="n accent-num">{storeLoading || storeError ? '···' : totalApprovedLifetime.toLocaleString()}</div><div className="l">Questions</div></div>
          <div className="stat"><div className="n accent-num">{storeLoading || storeError ? '···' : companies.length}</div><div className="l">Companies</div></div>
          <div className="stat"><div className="n accent-num">{storeLoading || storeError ? '···' : totalContributors}</div><div className="l">Contributors</div></div>
        </div>
      </div>

      {recentCompanies.length > 0 && <section className="home-continue" aria-labelledby="continue-heading">
        <div className="home-continue-heading"><div><div className="kicker">Your notebook · on this device</div><h2 id="continue-heading">Pick up where you left off.</h2></div><span>{solvedCount} solved · {bookmarkedCount} saved across companies</span></div>
        <div className="home-continue-list">{recentCompanies.map((company) => <Link key={company.id} to={`/c/${company.slug}`}><CompanyLogo name={company.name} size={24} /><strong>{company.name}</strong><span>Continue preparing ↗</span></Link>)}</div>
      </section>}

      <div className="home-search-bar">
        <div className="home-search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            aria-label="Search questions"
            className="input"
            placeholder={storeLoading || storeError ? 'Search questions…' : `Search ${totalApprovedLifetime.toLocaleString()} questions · try 'amazon sde-1 dp' or 'stripe onsite'`}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSubmitted(false);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              // Delayed so a click on a suggestion still lands before the
              // dropdown unmounts; tracked in a ref so unmounting mid-delay
              // can't fire setState on a dead component.
              window.clearTimeout(blurTimer.current);
              blurTimer.current = window.setTimeout(() => setFocused(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setSubmitted(true);
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
            }}
          />
          {showDropdown && (
            <div className="home-search-dropdown">
              {suggestions.map((item) => {
                const company = companiesById.get(item.companyId);
                return (
                  <Link
                    key={item.id}
                    to={`/q/${item.id}`}
                    className="home-search-suggestion"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <span className="home-search-suggestion-title">{item.title}</span>
                    <span className="home-search-suggestion-meta">{company?.name} · {item.difficulty ?? item.roleLevel}</span>
                  </Link>
                );
              })}
              {suggestions.length === 0 && (
                <div className="home-search-suggestion-empty">No questions match "{debouncedQuery}"</div>
              )}
              {searchResults && searchResults.length > SUGGESTION_LIMIT && (
                <button
                  type="button"
                  className="home-search-suggestion home-search-view-all"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setSubmitted(true)}
                >
                  View all {searchResults.length} results →
                </button>
              )}
            </div>
          )}
        </div>
        <div className="seg" role="group" aria-label="Question role">
          {ROLE_FILTERS.map((r) => (
            <button className="seg-opt" key={r} aria-pressed={roleFilter === r} onClick={() => setRoleFilter(r)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {submitted && searchError ? (
        <div className="home-recent">
          <ErrorState onRetry={retrySearch} />
        </div>
      ) : submitted && searchResults ? (
        <div className="home-recent">
          <div className="home-recent-head">
            <h3 style={{ fontSize: 18, margin: 0 }}>
              {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
              {searching && <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 13 }}> · searching…</span>}
            </h3>
          </div>
          <div className="home-recent-grid">
            {searchResults.slice(0, resultsVisible).map((item, i) => {
              const company = companiesById.get(item.companyId);
              return (
                <Link key={item.id} to={`/q/${item.id}`} className="blueprint card anim-item" style={{ animationDelay: staggerDelay(i) }}>
                  <Corners />
                  <div className="card-kicker">{company?.name} · {item.difficulty ?? item.roleLevel}</div>
                  <div className="card-title">{item.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {item.topicTags.map((t) => (
                      <span className="tag tag-accent" key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="card-meta">
                    {item.difficulty ? item.difficulty : `Asked ${item.askedMonthYear} · Community-submitted`} · ▲ {item.upvoteCount}
                  </div>
                </Link>
              );
            })}
            {searchResults.length === 0 && (
              <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>No questions match that search.</div>
            )}
          </div>
          {resultsVisible < searchResults.length && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: 16, padding: '10px 20px' }}
              onClick={() => setResultsVisible((n) => n + RESULTS_PAGE_SIZE)}
            >
              Load {Math.min(RESULTS_PAGE_SIZE, searchResults.length - resultsVisible)} more
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="section-heading" id="companies">
            <div>
              <h2>Who are you preparing for?</h2>
            </div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>
              {storeLoading || storeError
                ? '···'
                : companySearch
                  ? `${gridCompanies.length} of ${companies.length}`
                  : `${companies.length} companies`}
            </div>
          </div>

          <div className="home-company-search">
            <input
              aria-label="Find a company"
              className="input"
              placeholder="Find your company…"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
            />
          </div>

          <div className="home-company-grid">
            {storeLoading ? (
              <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>Loading companies…</div>
            ) : storeError ? (
              <ErrorState onRetry={refresh} />
            ) : (
              <>
                {gridCompanies.slice(0, companiesVisible).map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`blueprint home-company-tile anim-item${c.comingSoon ? ' coming-soon' : ''}`}
                    // Tiles arrive in sequence so the grid reads as filling in
                    // rather than flashing. Capped, so 60 tiles still settle
                    // inside a third of a second.
                    style={{ animationDelay: staggerDelay(i) }}
                    onClick={() => navigate(`/c/${c.slug}`)}
                  >
                    <Corners />
                    <CompanyLogo name={c.name} />
                    <div className="home-company-tile-name">{c.name}</div>
                    <div className="home-company-tile-count">
                      {c.comingSoon ? 'Coming soon' : `${c.questionCount.toLocaleString()} Q`}
                    </div>
                  </button>
                ))}
                {gridCompanies.length === 0 && (
                  <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>No companies match that search.</div>
                )}
              </>
            )}
          </div>

          {companiesVisible < gridCompanies.length && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: 16, padding: '10px 20px' }}
              onClick={() => setCompaniesVisible((n) => n + COMPANY_PAGE_SIZE)}
            >
              Load {Math.min(COMPANY_PAGE_SIZE, gridCompanies.length - companiesVisible)} more
            </button>
          )}

          {/* ---- Trending Questions Section ---- */}
          <div className="home-trending" id="trending">
            <div className="section-heading">
              <div>
                <h2>Trending Questions</h2>
              </div>
              <div style={{ fontSize: 13, opacity: 0.6 }}>Most confirmed questions across all companies</div>
            </div>
            <div className="home-trending-grid">
              {trendingError ? (
                <ErrorState compact onRetry={loadRecent} />
              ) : trending.slice(0, 6).map((item, i) => {
                const company = companiesById.get(item.companyId);
                const bookmarked = isBookmarked(item.id);
                return (
                  <div key={item.id} className="blueprint card trending-card anim-item" style={{ animationDelay: staggerDelay(i, 40) }}>
                    <Corners />
                    <div className="trending-card-header">
                      <Link to={`/q/${item.id}`} className="trending-card-link">
                        <div className="card-kicker">{company?.name} · {item.difficulty ?? item.roleLevel}</div>
                        <div className="card-title">{item.title}</div>
                      </Link>
                      <button
                        className={`bookmark-btn${bookmarked ? ' active' : ''}`}
                        onClick={() => toggleBookmark(item.id)}
                        title={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
                        aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                          <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {item.topicTags.slice(0, 3).map((t) => (
                        <span className="tag tag-accent" key={t}>{t}</span>
                      ))}
                    </div>
                    <div className="card-meta">▲ {item.upvoteCount} confirmed{item.frequency != null ? ` · freq ${item.frequency.toFixed(1)}` : ''}</div>
                  </div>
                );
              })}
              {!trendingError && trending.length === 0 && (
                <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>
                  {trendingLoaded ? 'No trending questions yet.' : 'Loading…'}
                </div>
              )}
            </div>
          </div>

          <div className="home-recent">
            <div className="home-recent-head">
              <h3 style={{ fontSize: 18, margin: 0 }}>Recently approved</h3>
            </div>
            <div className="home-recent-grid">
              {recentError ? (
                <ErrorState onRetry={loadRecent} />
              ) : (
                <>
                  {cardsToShow.map((item, i) => {
                    const company = companiesById.get(item.companyId);
                    return (
                      <Link key={item.id} to={`/q/${item.id}`} className="blueprint card anim-item" style={{ animationDelay: staggerDelay(i, 40) }}>
                        <Corners />
                        <div className="card-kicker">{company?.name} · {item.roleLevel} · {item.roundType}</div>
                        <div className="card-title">{item.title}</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {item.topicTags.map((t) => (
                            <span className="tag tag-accent" key={t}>{t}</span>
                          ))}
                        </div>
                        <div className="card-meta">Asked {item.askedMonthYear} · Community-submitted · ▲ {item.upvoteCount}</div>
                      </Link>
                    );
                  })}
                  {cardsToShow.length === 0 && (
                    <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>
                      {recentLoaded ? 'Nothing approved yet.' : 'Loading…'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      <div className="home-footer">
        <div>CrackList · community-owned · MIT license · self-hostable</div>
      </div>
    </div>
  );
}
