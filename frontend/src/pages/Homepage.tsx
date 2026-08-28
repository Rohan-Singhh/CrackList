import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Corners } from '../components/Blueprint';
import { Nav } from '../components/Nav';
import { CompanyLogo } from '../components/CompanyLogo';
import { useStore } from '../lib/store';
import { useLocalProgress } from '../lib/useLocalProgress';
import { adaptQuestion } from '../lib/adapt';
import { api } from '../lib/api';
import type { Question } from '../lib/types';
import './Homepage.css';

const ROLE_FILTERS = ['All', 'Intern', 'SDE-1', 'SDE-2+'] as const;

export default function Homepage() {
  const { companies, questions, totalApprovedLifetime, totalContributors } = useStore();
  const { isBookmarked, toggleBookmark } = useLocalProgress();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>('All');
  const [trending, setTrending] = useState<Question[]>([]);

  useEffect(() => {
    api.trending().then((data) => setTrending(data.map(adaptQuestion))).catch(() => {});
  }, []);

  const approved = useMemo(() => questions.filter((q) => q.status === 'approved'), [questions]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.trim().toLowerCase();
    return approved.filter((item) => {
      const company = companies.find((c) => c.id === item.companyId);
      const roleOk =
        roleFilter === 'All' ||
        (roleFilter === 'SDE-2+' ? ['SDE-2', 'SDE-3', 'Senior'].includes(item.roleLevel) : item.roleLevel === roleFilter);
      if (!roleOk) return false;
      return (
        item.title.toLowerCase().includes(q) ||
        company?.name.toLowerCase().includes(q) ||
        item.topicTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, roleFilter, approved, companies]);

  const recentlyApproved = useMemo(
    () =>
      [...approved]
        .sort((a, b) => (b.approvedAt ?? '').localeCompare(a.approvedAt ?? ''))
        .slice(0, 3),
    [approved],
  );

  const cardsToShow = searchResults ?? recentlyApproved;

  const [companySearch, setCompanySearch] = useState('');
  const sortedCompanies = useMemo(() => [...companies].sort((a, b) => b.questionCount - a.questionCount), [companies]);
  const gridCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return sortedCompanies;
    return sortedCompanies.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedCompanies, companySearch]);

  // Scroll to #trending if the URL hash is set (e.g. from nav click on another page).
  useEffect(() => {
    if (window.location.hash === '#trending') {
      setTimeout(() => {
        document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, []);

  return (
    <div className="page-shell">
      <Nav />

      <div className="home-hero">
        <div>
          <div className="kicker" style={{ marginBottom: 20 }}>A community index · v1 · 2026</div>
          <h1>
            Real interview questions,
            <br />
            <span style={{ color: 'var(--color-accent)' }}>tagged by the people who got asked them.</span>
          </h1>
          <p>
            A free, community-verified database of what companies actually ask in technical rounds. No paywall. No
            dumps of generic DSA. Sourced, dated, and linked back to origin.
          </p>
          <div className="home-hero-actions">
            <a
              href="#companies"
              className="btn btn-primary blueprint"
              style={{ padding: '12px 22px', fontSize: 14 }}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('companies')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Browse companies
              <Corners />
            </a>
            <Link to="/contribute" className="btn btn-secondary" style={{ padding: '12px 22px', fontSize: 14 }}>
              Contribute a question
            </Link>
          </div>
        </div>

        <div className="home-hero-stats">
          <div className="stat"><div className="n accent-num">{totalApprovedLifetime.toLocaleString()}</div><div className="l">Questions</div></div>
          <div className="stat"><div className="n accent-num">{companies.length}</div><div className="l">Companies</div></div>
          <div className="stat"><div className="n accent-num">{totalContributors}</div><div className="l">Contributors</div></div>
          <div className="stat"><div className="n">Amazon</div><div className="l">Top this week</div></div>
          <div className="stat"><div className="n">Aug '26</div><div className="l">Latest add</div></div>
          <div className="stat"><div className="n">100%</div><div className="l">Free · always</div></div>
        </div>
      </div>

      <div className="home-search-bar">
        <div className="home-search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className="input"
            placeholder={`Search ${totalApprovedLifetime.toLocaleString()} questions · try 'amazon sde-1 dp' or 'stripe onsite'`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="seg">
          {ROLE_FILTERS.map((r) => (
            <label className="seg-opt" key={r}>
              <input type="radio" name="f" hidden checked={roleFilter === r} onChange={() => setRoleFilter(r)} />
              {r}
            </label>
          ))}
        </div>
      </div>

      {searchResults ? (
        <div className="home-recent">
          <div className="home-recent-head">
            <h3 style={{ fontSize: 18, margin: 0 }}>{searchResults.length} result{searchResults.length === 1 ? '' : 's'}</h3>
          </div>
          <div className="home-recent-grid">
            {searchResults.map((item) => {
              const company = companies.find((c) => c.id === item.companyId);
              return (
                <Link key={item.id} to={`/q/${item.id}`} className="blueprint card">
                  <Corners />
                  <div className="card-kicker">{company?.name} · {item.difficulty ?? item.roleLevel}</div>
                  <div className="card-title">{item.title}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {item.topicTags.map((t) => (
                      <span className="tag tag-accent" key={t}>{t}</span>
                    ))}
                  </div>
                  <div className="card-meta">
                    {item.difficulty ? item.difficulty : `Asked ${item.askedMonthYear} · ${item.sourceLabel}`} · ▲ {item.upvoteCount}
                  </div>
                </Link>
              );
            })}
            {searchResults.length === 0 && (
              <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>No questions match that search.</div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="section-heading" id="companies">
            <div>
              <div className="kicker">Section · 01</div>
              <h2>Companies</h2>
            </div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>{gridCompanies.length} of {companies.length} · click a card to browse its questions</div>
          </div>

          <div className="home-company-search">
            <input
              className="input"
              placeholder="Filter companies by name…"
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
            />
          </div>

          <div className="home-company-grid">
            {gridCompanies.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`blueprint home-company-tile${c.comingSoon ? ' coming-soon' : ''}`}
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
          </div>

          {/* ---- Trending Questions Section ---- */}
          <div className="home-trending" id="trending">
            <div className="section-heading">
              <div>
                <div className="kicker">Section · 02</div>
                <h2>Trending Questions</h2>
              </div>
              <div style={{ fontSize: 13, opacity: 0.6 }}>Most confirmed questions across all companies</div>
            </div>
            <div className="home-trending-grid">
              {trending.slice(0, 6).map((item) => {
                const company = companies.find((c) => c.id === item.companyId);
                const bookmarked = isBookmarked(item.id);
                return (
                  <div key={item.id} className="blueprint card trending-card">
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
              {trending.length === 0 && (
                <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>No trending questions yet.</div>
              )}
            </div>
          </div>

          <div className="home-recent">
            <div className="home-recent-head">
              <h3 style={{ fontSize: 18, margin: 0 }}>Recently approved</h3>
            </div>
            <div className="home-recent-grid">
              {cardsToShow.map((item) => {
                const company = companies.find((c) => c.id === item.companyId);
                return (
                  <Link key={item.id} to={`/q/${item.id}`} className="blueprint card">
                    <Corners />
                    <div className="card-kicker">{company?.name} · {item.roleLevel} · {item.roundType}</div>
                    <div className="card-title">{item.title}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {item.topicTags.map((t) => (
                        <span className="tag tag-accent" key={t}>{t}</span>
                      ))}
                    </div>
                    <div className="card-meta">Asked {item.askedMonthYear} · {item.sourceLabel} · ▲ {item.upvoteCount}</div>
                  </Link>
                );
              })}
              {cardsToShow.length === 0 && (
                <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>Nothing approved yet.</div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="home-footer">
        <div>CrackList · community-owned · MIT license · self-hostable</div>
        <div>github.com/cracklist · @cracklist_dev</div>
      </div>
    </div>
  );
}
