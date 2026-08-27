import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Blueprint, Corners } from '../components/Blueprint';
import { Nav } from '../components/Nav';
import { useStore } from '../lib/store';
import './Homepage.css';

const HUB = { x: 580, y: 230 };
const INTERCONNECTS: Array<[string, string]> = [
  ['google', 'amazon'],
  ['microsoft', 'meta'],
  ['infosys', 'flipkart'],
  ['stripe', 'tcs'],
  ['google', 'flipkart'],
  ['amazon', 'uber'],
  ['uber', 'microsoft'],
];

const ROLE_FILTERS = ['All', 'Intern', 'SDE-1', 'SDE-2+'] as const;

export default function Homepage() {
  const { companies, questions, totalApprovedLifetime, totalContributors } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_FILTERS)[number]>('All');

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
              href="#graph"
              className="btn btn-primary blueprint"
              style={{ padding: '12px 22px', fontSize: 14 }}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('graph')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Browse the graph
              <Corners />
            </a>
            <Link to="/contribute" className="btn btn-secondary" style={{ padding: '12px 22px', fontSize: 14 }}>
              Contribute a question
            </Link>
          </div>
        </div>

        <div className="home-hero-stats">
          <div className="stat"><div className="n accent-num">{totalApprovedLifetime.toLocaleString()}</div><div className="l">Questions</div></div>
          <div className="stat"><div className="n accent-num">147</div><div className="l">Companies</div></div>
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

      <div className="section-heading" id="graph">
        <div>
          <div className="kicker">Section · 01</div>
          <h2>Companies</h2>
        </div>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Click a node to expand its question graph →</div>
      </div>

      <div className="home-graph-wrap">
        <Blueprint className="home-graph">
          <svg viewBox="0 0 1160 460" className="home-graph-svg">
            <g stroke="currentColor" strokeWidth={1} opacity={0.25} fill="none">
              {companies.map((c) => (
                <line key={c.id} x1={HUB.x} y1={HUB.y} x2={c.x} y2={c.y} />
              ))}
              {INTERCONNECTS.map(([a, b]) => {
                const ca = companies.find((c) => c.id === a);
                const cb = companies.find((c) => c.id === b);
                if (!ca || !cb) return null;
                return <line key={`${a}-${b}`} x1={ca.x} y1={ca.y} x2={cb.x} y2={cb.y} />;
              })}
            </g>
          </svg>

          <div className="home-graph-hub">147<br />companies</div>

          {companies.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`home-graph-node${c.id === 'amazon' ? ' featured' : ''}${c.comingSoon ? ' coming-soon' : ''}`}
              style={{ left: c.x, top: c.y }}
              onClick={() => navigate(`/c/${c.slug}`)}
              aria-label={`Open ${c.name} question graph`}
            >
              <div className="box" style={{ width: c.size, height: c.size, fontSize: Math.max(11, c.size * 0.14) }}>
                <div>{c.name}</div>
                {!c.comingSoon && <div className="count" style={{ fontSize: Math.max(10, c.size * 0.1) }}>{c.questionCount} Q</div>}
              </div>
            </button>
          ))}

          <div className="home-graph-legend">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="swatch" style={{ background: 'var(--color-accent)' }} /> node size = question count
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="swatch" style={{ border: '1px solid var(--color-text)' }} /> click to expand →
            </div>
          </div>
        </Blueprint>
      </div>

      <div className="home-recent">
        <div className="home-recent-head">
          <h3 style={{ fontSize: 18, margin: 0 }}>{searchResults ? `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}` : 'Recently approved'}</h3>
          {!searchResults && <span className="btn btn-ghost" style={{ fontSize: 12 }}>View all →</span>}
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
            <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>No questions match that search yet.</div>
          )}
        </div>
      </div>

      <div className="home-footer">
        <div>CrackList · community-owned · MIT license · self-hostable</div>
        <div>github.com/cracklist · @cracklist_dev</div>
      </div>
    </div>
  );
}
