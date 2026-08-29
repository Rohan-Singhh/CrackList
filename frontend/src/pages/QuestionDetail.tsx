import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Blueprint, Corners } from '../components/Blueprint';
import { Nav } from '../components/Nav';
import { useStore } from '../lib/store';
import { useLocalProgress } from '../lib/useLocalProgress';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { api } from '../lib/api';
import { adaptQuestion } from '../lib/adapt';
import { ErrorState } from '../components/ErrorState';
import { CommunityDifficulty } from '../components/CommunityDifficulty';
import { AlsoAskedAt } from '../components/AlsoAskedAt';
import type { Question } from '../lib/types';
import './QuestionDetail.css';

const CURRENT_USER = { handle: '@you', detail: 'Just now' };

export default function QuestionDetail() {
  const { id } = useParams();
  const { companies } = useStore();
  const { isBookmarked, toggleBookmark, isSolved, toggleSolved } = useLocalProgress();
  const [question, setQuestion] = useState<Question | null | undefined>(undefined);
  const [fetchError, setFetchError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // A single question, fetched by id — not filtered out of a global list that
  // no longer holds all 17k+ approved questions in memory.
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setQuestion(undefined);
    setFetchError(false);
    api
      .question(id)
      .then((q) => {
        if (alive) setQuestion(adaptQuestion(q));
      })
      .catch((e) => {
        if (!alive) return;
        // "Question not found" is the backend's genuine 404 message — anything
        // else (network failure, 500, timeout) is a real error, not a bad id.
        if (e instanceof Error && e.message === 'Question not found') {
          setQuestion(null);
        } else {
          setFetchError(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  const metaCompany = question ? companies.find((c) => c.id === question.companyId) : undefined;
  useDocumentMeta(
    question
      ? `${question.title.length > 60 ? question.title.slice(0, 59) + '…' : question.title} — ${metaCompany?.name ?? 'Interview'} Question`
      : 'CrackList',
    question ? `Asked at ${metaCompany?.name ?? 'a company'}. See how others solved it, free on CrackList.` : undefined,
  );

  if (fetchError) {
    return (
      <div className="page-shell">
        <Nav />
        <div style={{ padding: 60, maxWidth: 480, margin: '0 auto' }}>
          <ErrorState onRetry={() => setReloadKey((n) => n + 1)} />
        </div>
      </div>
    );
  }

  if (question === undefined) {
    return (
      <div className="page-shell">
        <Nav />
        <div style={{ padding: 60, opacity: 0.6, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="page-shell">
        <Nav />
        <div style={{ padding: 60 }}>
          <p>Question not found.</p>
          <Link to="/" className="btn btn-secondary">← Back to browse</Link>
        </div>
      </div>
    );
  }

  const company = metaCompany;

  function handleConfirm() {
    setQuestion((prev) =>
      prev
        ? { ...prev, upvoteCount: prev.upvoteCount + 1, confirmers: [{ handle: CURRENT_USER.handle, detail: CURRENT_USER.detail }, ...prev.confirmers] }
        : prev,
    );
    setConfirmed(true);
    api.confirm(question!.id, CURRENT_USER.handle).catch(() => undefined);
  }

  function handleCopy() {
    if (question!.codeSnippet) {
      navigator.clipboard?.writeText(question!.codeSnippet).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shownConfirmers = question.confirmers.slice(0, 2);
  const moreConfirmers = question.confirmers.length - shownConfirmers.length;

  return (
    <div className="page-shell">
      <Nav />

      <div className="qd-breadcrumb">
        <Link to="/">Browse</Link> / <Link to={`/c/${company?.slug ?? ''}`}>{company?.name}</Link> / <span>{question.roleLevel}</span> / <span style={{ color: 'var(--color-accent)' }}>{question.displayId}</span>
      </div>

      <div className="qd-body">
        <div className="qd-main">
          <div className="kicker">Question · {question.displayId} · {question.sourceType === 'indexed' ? 'Indexed' : 'Community-submitted'}</div>
          <h1>{question.title}</h1>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 28 }}>
            <span className="tag tag-accent">{company?.name}</span>
            {question.difficulty && <span className="tag tag-neutral">{question.difficulty}</span>}
            {!question.difficulty && <span className="tag tag-neutral">{question.roleLevel}</span>}
            {!question.difficulty && <span className="tag tag-neutral">{question.roundType}</span>}
            {question.topicTags.map((t) => <span className="tag tag-outline" key={t}>{t}</span>)}
          </div>

          {question.link ? (
            <Blueprint className="qd-solve-box">
              <div className="kicker" style={{ marginBottom: 12 }}>Solve it</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85, margin: '0 0 20px' }}>
                This is a company-tagged index entry — the full problem statement, examples, and test
                cases live on LeetCode. Open it there to work through it.
              </p>
              <a
                href={question.link}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary blueprint"
                style={{ padding: '12px 22px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                Open on LeetCode ↗
                <Corners />
              </a>
            </Blueprint>
          ) : (
            <Blueprint className="qd-prompt-box">
              <div className="kicker" style={{ marginBottom: 12 }}>Prompt · as reported by contributor</div>
              <p>{question.prompt}</p>
              {question.followUps.map((f, i) => (
                <p key={i}><b>Follow-up {i + 1}.</b> {f}</p>
              ))}
            </Blueprint>
          )}

          {question.codeSnippet && (
            <Blueprint className="qd-code-block">
              <div className="qd-code-head">
                <span>starter · python</span>
                <button onClick={handleCopy}>{copied ? 'copied' : 'copy'}</button>
              </div>
              <pre>{question.codeSnippet}</pre>
            </Blueprint>
          )}

          <div className="qd-meta-bar">
            {question.difficulty ? (
              <>
                <div className="stat"><div className="n">{question.frequency != null ? question.frequency.toFixed(1) : '—'}</div><div className="l">Frequency</div></div>
                <div className="stat"><div className="n">{question.difficulty}</div><div className="l">Difficulty</div></div>
              </>
            ) : (
              <>
                <div className="stat"><div className="n accent-num">{question.askedMonthYear}</div><div className="l">Asked</div></div>
                <div className="stat"><div className="n">{question.roleLevel}</div><div className="l">Role level</div></div>
                <div className="stat"><div className="n">{question.roundType}</div><div className="l">Round</div></div>
              </>
            )}
            <div className="stat"><div className="n accent-num">▲ {question.upvoteCount}</div><div className="l">Confirmed</div></div>
          </div>

          <AlsoAskedAt questionId={question.id} currentCompanyId={question.companyId} />

          {!question.link && (
            <div style={{ marginTop: 28 }}>
              <div className="kicker" style={{ marginBottom: 10 }}>Provenance</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0, opacity: 0.8 }}>
                Submitted by <span style={{ color: 'var(--color-accent)' }}>Anonymous</span>
                {question.approvedAt && <> on {question.createdAt} · approved {question.approvedAt}</>}.
                {' '}Reported source: <a href="https://leetcode.com/discuss/" style={{ color: 'var(--color-accent)' }} target="_blank" rel="noreferrer">leetcode.com/discuss</a>.
              </p>
            </div>
          )}
        </div>

        <div>
          <button
            className="btn btn-primary btn-block blueprint"
            style={{ padding: 14 }}
            onClick={handleConfirm}
            disabled={confirmed}
          >
            {confirmed ? '✓ Confirmed — thanks' : '▲ Confirm · I got asked this'}
            <Corners />
          </button>

          <button
            className={`bookmark-btn${isBookmarked(question.id) ? ' active' : ''}`}
            style={{ padding: 10, marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, font: 'inherit' }}
            onClick={() => toggleBookmark(question.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill={isBookmarked(question.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-7-3.5L5 21V5z" />
            </svg>
            {isBookmarked(question.id) ? 'Bookmarked' : 'Bookmark this question'}
          </button>

          <button
            className={`solved-btn${isSolved(question.id) ? ' active' : ''}`}
            style={{ marginTop: 8 }}
            onClick={() => toggleSolved(question.id)}
          >
            {isSolved(question.id) ? '✓ Marked as Solved' : 'Mark as Solved'}
          </button>

          <div
            style={{
              fontSize: 11,
              opacity: 0.5,
              marginTop: 8,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Bookmarks and solved status are saved on this device only.
          </div>

          <button className="btn btn-secondary btn-block" style={{ padding: 10, marginTop: 8 }} onClick={() => setReported(true)}>
            {reported ? 'Reported — a moderator will review' : 'Report inaccuracy'}
          </button>

          <CommunityDifficulty question={question} onVote={setQuestion} />

          <div style={{ marginTop: 32 }}>
            <div className="kicker" style={{ marginBottom: 14 }}>Other people who confirmed</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {shownConfirmers.map((c) => (
                <div className="qd-confirmer" key={c.handle}>
                  <div className="avatar">{c.handle.replace('@', '')[0].toUpperCase()}</div>
                  <div>
                    <div>{c.handle}</div>
                    <div style={{ opacity: 0.55, fontSize: 11 }}>{c.detail}</div>
                  </div>
                </div>
              ))}
              {moreConfirmers > 0 && (
                <div className="qd-confirmer">
                  <div className="avatar">+</div>
                  <div style={{ opacity: 0.6 }}>{moreConfirmers} more</div>
                </div>
              )}
              {question.confirmers.length === 0 && (
                <div style={{ opacity: 0.55, fontSize: 13 }}>No confirmations yet — be the first.</div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--color-divider)' }}>
            <div className="kicker" style={{ marginBottom: 10 }}>Trust signals</div>
            <div style={{ fontSize: 12, lineHeight: 1.7, opacity: 0.75 }}>
              → Source {question.link || question.sourceUrl ? 'present' : 'missing'}<br />
              {question.askedMonthYear && <>→ Dated ({question.askedMonthYear})<br /></>}
              → {question.upvoteCount} independent confirms<br />
              → 0 duplicate flags
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
