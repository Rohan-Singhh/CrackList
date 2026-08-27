import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Blueprint, Corners } from '../components/Blueprint';
import { Nav } from '../components/Nav';
import { useStore } from '../lib/store';
import type { Question, RoleLevel } from '../lib/types';
import './CompanyDetail.css';

const ROLE_OPTS: Array<'All roles' | RoleLevel> = ['All roles', 'Intern', 'SDE-1', 'SDE-2', 'SDE-3', 'Senior'];
const ROUND_OPTS = ['Any round', 'OA', 'Phone', 'Tech', 'HR'] as const;

// Rendering every question as an SVG node stops being legible past a few
// hundred (some companies now carry 1000+ indexed questions) — cap the graph
// to the highest-signal subset and let the searchable list below cover the rest.
const GRAPH_NODE_CAP = 150;
const LIST_PAGE_SIZE = 40;

const CLUSTER_LABEL_POS: Record<string, React.CSSProperties> = {
  arrays: { left: 80, top: 40 },
  dp: { right: 60, top: 70 },
  graphs: { left: 80, bottom: 40 },
  trees: { right: 60, bottom: 40 },
};

function roundMatches(round: Question['roundType'], filter: (typeof ROUND_OPTS)[number]) {
  if (filter === 'Any round') return true;
  if (filter === 'Phone') return round === 'Phone screen';
  if (filter === 'Tech') return round === 'Tech-1' || round === 'Tech-2' || round === 'Tech-3';
  return round === filter;
}

export default function CompanyDetail() {
  const { slug } = useParams();
  const { companies, questions, upvoteQuestion } = useStore();
  const company = companies.find((c) => c.slug === slug);

  const companyQuestions = useMemo(
    () => questions.filter((q) => q.companyId === company?.id && q.status === 'approved'),
    [questions, company],
  );
  const laidOutQuestions = useMemo(() => companyQuestions.filter((q) => q.x || q.y), [companyQuestions]);
  const graphQuestions = useMemo(() => {
    if (laidOutQuestions.length <= GRAPH_NODE_CAP) return laidOutQuestions;
    return [...laidOutQuestions]
      .sort((a, b) => (b.frequency ?? b.upvoteCount) - (a.frequency ?? a.upvoteCount))
      .slice(0, GRAPH_NODE_CAP);
  }, [laidOutQuestions]);
  const hasGraph = graphQuestions.length > 0;

  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_OPTS)[number]>('All roles');
  const [roundFilter, setRoundFilter] = useState<(typeof ROUND_OPTS)[number]>('Any round');
  const [activeTags, setActiveTags] = useState<string[]>(hasGraph ? ['arrays', 'dp'] : []);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(
    graphQuestions.find((q) => q.id === 'q-1046')?.id ?? graphQuestions[0]?.id ?? null,
  );

  const [listSearch, setListSearch] = useState('');
  const [listVisible, setListVisible] = useState(LIST_PAGE_SIZE);
  const listQuestions = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return companyQuestions;
    return companyQuestions.filter(
      (item) => item.title.toLowerCase().includes(q) || item.topicTags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [companyQuestions, listSearch]);

  const clusterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    graphQuestions.forEach((q) => {
      counts[q.cluster] = (counts[q.cluster] ?? 0) + 1;
    });
    return counts;
  }, [graphQuestions]);

  function matchesFilters(q: Question) {
    const roleOk = roleFilter === 'All roles' || q.roleLevel === roleFilter;
    const roundOk = roundMatches(q.roundType, roundFilter);
    const tagOk = activeTags.length === 0 || activeTags.includes(q.cluster) || q.topicTags.some((t) => activeTags.includes(t));
    return roleOk && roundOk && tagOk;
  }

  const selected = graphQuestions.find((q) => q.id === selectedId) ?? null;
  const related = selected
    ? graphQuestions.filter((q) => q.cluster === selected.cluster && q.id !== selected.id).sort((a, b) => b.upvoteCount - a.upvoteCount).slice(0, 3)
    : [];

  if (!company) {
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

  return (
    <div className="page-shell">
      <Nav />

      <div className="company-header">
        <Blueprint style={{ width: 128, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontSize: 36, color: 'var(--color-accent)' }}>
          {company.name[0]}
        </Blueprint>
        <div style={{ flex: 1 }}>
          <div className="kicker">Company · {companies.findIndex((c) => c.id === company.id) + 1} of {companies.length}</div>
          <h1>{company.name}</h1>
          <div className="company-header-meta">
            <span><span style={{ color: 'var(--color-accent)' }}>{company.questionCount}</span> questions</span>
            <span><span style={{ color: 'var(--color-accent)' }}>{company.contributorCount}</span> contributors</span>
            <span>most recent · {company.mostRecent}</span>
            <span>most active · {company.mostActiveRole}</span>
          </div>
        </div>
        <Link to="/contribute" className="btn btn-primary blueprint" style={{ padding: '12px 22px' }}>
          Add a question
          <Corners />
        </Link>
      </div>

      {hasGraph && (
        <div className="company-filters">
          <div style={{ fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', opacity: 0.55 }}>Filter</div>
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
          <div className="active-tags">
            {activeTags.map((t) => (
              <button key={t} className="tag tag-outline" onClick={() => setActiveTags((tags) => tags.filter((x) => x !== t))}>
                {t} ×
              </button>
            ))}
          </div>
        </div>
      )}

      {hasGraph && (
        <div className="company-graph-row">
          <div className="company-graph-col">
            <Blueprint className="company-graph">
              <div className="company-graph-canvas" style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
                {Object.entries(clusterCounts).map(([cluster, count]) => (
                  CLUSTER_LABEL_POS[cluster] ? (
                    <div className="cluster-label" key={cluster} style={CLUSTER_LABEL_POS[cluster]}>{cluster} · {count}</div>
                  ) : null
                ))}

                <svg viewBox="0 0 700 620" className="company-graph-svg">
                  <g stroke="currentColor" strokeWidth={1} opacity={0.22} fill="none">
                    {graphQuestions.map((q) =>
                      graphQuestions
                        .filter((o) => o.cluster === q.cluster && o.id > q.id)
                        .slice(0, 2)
                        .map((o) => <line key={`${q.id}-${o.id}`} x1={q.x} y1={q.y} x2={o.x} y2={o.y} />),
                    )}
                  </g>
                  <g fill="var(--color-bg)" stroke="currentColor" strokeWidth={1}>
                    {graphQuestions.map((q) => {
                      const dim = !matchesFilters(q);
                      const isSelected = q.id === selectedId;
                      if (isSelected) return null;
                      return (
                        <circle
                          key={q.id}
                          cx={q.x}
                          cy={q.y}
                          r={q.r}
                          opacity={dim ? 0.25 : 1}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedId(q.id)}
                        >
                          <title>{q.title}</title>
                        </circle>
                      );
                    })}
                  </g>
                  {selected && (
                    <>
                      <circle cx={selected.x} cy={selected.y} r={selected.r + 3} fill="var(--color-accent)" stroke="var(--color-accent)" strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => setSelectedId(selected.id)} />
                      <circle cx={selected.x} cy={selected.y} r={selected.r + 11} fill="none" stroke="var(--color-accent)" strokeWidth={1} strokeDasharray="2 3" />
                    </>
                  )}
                </svg>
              </div>

              <div className="graph-caption">
                {graphQuestions.length} shown of {company.questionCount} total
                {laidOutQuestions.length > GRAPH_NODE_CAP && ' · top nodes by frequency — search the full list below for the rest'}
                {' '}· zoom {Math.round(zoom * 100)}% · click node → preview
              </div>
              <div className="graph-zoom">
                <button className="btn btn-secondary btn-icon" style={{ background: 'var(--color-bg)' }} onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>+</button>
                <button className="btn btn-secondary btn-icon" style={{ background: 'var(--color-bg)' }} onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>−</button>
              </div>
            </Blueprint>
          </div>

          <div className="company-side-panel">
            {selected ? (
              <>
                <div className="kicker">Selected question · {selected.displayId}</div>
                <h3>{selected.title}</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                  {selected.topicTags.map((t) => <span className="tag tag-accent" key={t}>{t}</span>)}
                  <span className="tag tag-neutral">{selected.roleLevel}</span>
                  <span className="tag tag-neutral">{selected.roundType}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '10px 16px', fontSize: 13, marginBottom: 24 }}>
                  <div style={{ opacity: 0.55 }}>Asked</div><div>{selected.askedMonthYear}</div>
                  <div style={{ opacity: 0.55 }}>Source</div><div>{selected.sourceType === 'indexed' ? 'Indexed' : 'Community'} · <span style={{ color: 'var(--color-accent)' }}>{selected.submittedBy}</span></div>
                  {selected.approvedAt && (<><div style={{ opacity: 0.55 }}>Approved</div><div>{selected.approvedAt} by {selected.approvedBy}</div></>)}
                  <div style={{ opacity: 0.55 }}>Upvotes</div><div>{selected.upvoteCount}</div>
                </div>

                <p style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.55, margin: '0 0 24px' }}>{selected.prompt}</p>

                <Link to={`/q/${selected.id}`} className="btn btn-primary btn-block blueprint" style={{ padding: 12 }}>
                  Open question
                  <Corners />
                </Link>
                <button className="btn btn-secondary btn-block" style={{ padding: 10 }} onClick={() => upvoteQuestion(selected.id)}>
                  ▲ Upvote · {selected.upvoteCount}
                </button>

                {related.length > 0 && (
                  <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--color-divider)' }}>
                    <div className="kicker" style={{ marginBottom: 10 }}>Related · same cluster</div>
                    <div className="company-related">
                      {related.map((r) => (
                        <Link key={r.id} to={`/q/${r.id}`}>
                          <span>{r.title}</span>
                          <span style={{ opacity: 0.5, fontFamily: 'var(--font-mono)' }}>▲ {r.upvoteCount}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p style={{ opacity: 0.6, fontSize: 14 }}>Click a node to preview a question.</p>
            )}
          </div>
        </div>
      )}

      {companyQuestions.length > 0 ? (
        <div className="company-list-section" style={{ marginTop: hasGraph ? 32 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="kicker">All questions · {listQuestions.length} of {companyQuestions.length}</div>
            <input
              type="text"
              value={listSearch}
              onChange={(e) => {
                setListSearch(e.target.value);
                setListVisible(LIST_PAGE_SIZE);
              }}
              placeholder="Search title or topic…"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-divider)',
                color: 'inherit',
                fontFamily: 'inherit',
                padding: '8px 12px',
                minWidth: 220,
              }}
            />
          </div>
          <div className="company-list-fallback">
            {listQuestions.slice(0, listVisible).map((q) => (
              <Link key={q.id} to={`/q/${q.id}`} className="blueprint card">
                <Corners />
                <div className="card-kicker">
                  {company.name} · {q.difficulty ?? q.roleLevel} · {q.difficulty ? '' : q.roundType}
                </div>
                <div className="card-title">{q.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {q.topicTags.map((t) => <span className="tag tag-accent" key={t}>{t}</span>)}
                </div>
                <div className="card-meta">
                  {q.difficulty ? `Frequency ${q.frequency?.toFixed(1) ?? '—'}` : `Asked ${q.askedMonthYear} · ${q.sourceLabel}`} · ▲ {q.upvoteCount}
                </div>
              </Link>
            ))}
          </div>
          {listVisible < listQuestions.length && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: 16, padding: '10px 20px' }}
              onClick={() => setListVisible((n) => n + LIST_PAGE_SIZE)}
            >
              Load {Math.min(LIST_PAGE_SIZE, listQuestions.length - listVisible)} more
            </button>
          )}
        </div>
      ) : (
        <div className="graph-empty">
          <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 420 }}>
            No approved questions for {company.name} yet — the question graph fills in as submissions come in.
          </p>
          <Link to="/contribute" className="btn btn-primary blueprint" style={{ padding: '12px 22px' }}>
            Be the first to contribute
            <Corners />
          </Link>
        </div>
      )}
    </div>
  );
}
