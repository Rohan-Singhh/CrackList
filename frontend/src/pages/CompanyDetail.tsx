import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Blueprint, Corners } from '../components/Blueprint';
import { Nav } from '../components/Nav';
import { useStore } from '../lib/store';
import { useLocalProgress } from '../lib/useLocalProgress';
import { CompanyLogo } from '../components/CompanyLogo';
import type { Question, RoleLevel } from '../lib/types';
import './CompanyDetail.css';

const ROLE_OPTS: Array<'All roles' | RoleLevel> = ['All roles', 'Intern', 'SDE-1', 'SDE-2', 'SDE-3', 'Senior'];
const ROUND_OPTS = ['Any round', 'OA', 'Phone', 'Tech', 'HR'] as const;
const DIFFICULTY_OPTS = ['All', 'Easy', 'Medium', 'Hard'] as const;

const LIST_PAGE_SIZE = 40;

function roundMatches(round: Question['roundType'], filter: (typeof ROUND_OPTS)[number]) {
  if (filter === 'Any round') return true;
  if (filter === 'Phone') return round === 'Phone screen';
  if (filter === 'Tech') return round === 'Tech-1' || round === 'Tech-2' || round === 'Tech-3';
  return round === filter;
}

export default function CompanyDetail() {
  const { slug } = useParams();
  const { companies, questions } = useStore();
  const { isBookmarked, toggleBookmark, isSolved, toggleSolved } = useLocalProgress();
  const company = companies.find((c) => c.slug === slug);

  const companyQuestions = useMemo(
    () => questions.filter((q) => q.companyId === company?.id && q.status === 'approved'),
    [questions, company],
  );

  const hasIndexed = companyQuestions.some((q) => q.difficulty);

  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_OPTS)[number]>('All roles');
  const [roundFilter, setRoundFilter] = useState<(typeof ROUND_OPTS)[number]>('Any round');
  const [difficultyFilter, setDifficultyFilter] = useState<(typeof DIFFICULTY_OPTS)[number]>('All');
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(LIST_PAGE_SIZE);

  const listQuestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companyQuestions.filter((item) => {
      if (item.difficulty) {
        if (difficultyFilter !== 'All' && item.difficulty !== difficultyFilter) return false;
      } else {
        if (roleFilter !== 'All roles' && item.roleLevel !== roleFilter) return false;
        if (!roundMatches(item.roundType, roundFilter)) return false;
      }
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.topicTags.some((t) => t.toLowerCase().includes(q));
    });
  }, [companyQuestions, roleFilter, roundFilter, difficultyFilter, search]);

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
        <Blueprint style={{ width: 128, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CompanyLogo name={company.name} size={72} />
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

      {companyQuestions.length > 0 && (
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
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(LIST_PAGE_SIZE);
            }}
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

      {companyQuestions.length > 0 ? (
        <div className="company-question-table-wrap">
          <div className="kicker" style={{ padding: '0 0 12px' }}>{listQuestions.length} of {companyQuestions.length} questions</div>
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
              {listQuestions.slice(0, visible).map((q, i) => (
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
                      title={isBookmarked(q.id) ? 'Remove bookmark' : 'Bookmark'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={isBookmarked(q.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                        <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    <button
                      className={`solved-btn${isSolved(q.id) ? ' active' : ''}`}
                      onClick={() => toggleSolved(q.id)}
                      title={isSolved(q.id) ? 'Marked solved' : 'Mark as solved'}
                    >
                      ✓
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {listQuestions.length === 0 && (
            <div style={{ opacity: 0.6, fontSize: 14, padding: '20px 0' }}>No questions match those filters.</div>
          )}
          {visible < listQuestions.length && (
            <button
              className="btn btn-secondary"
              style={{ marginTop: 16, padding: '10px 20px' }}
              onClick={() => setVisible((n) => n + LIST_PAGE_SIZE)}
            >
              Load {Math.min(LIST_PAGE_SIZE, listQuestions.length - visible)} more
            </button>
          )}
        </div>
      ) : (
        <div className="graph-empty">
          <p style={{ opacity: 0.7, fontSize: 14, maxWidth: 420 }}>
            No approved questions for {company.name} yet.
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
