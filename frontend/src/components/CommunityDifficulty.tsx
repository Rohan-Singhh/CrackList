import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { adaptQuestion } from '../lib/adapt';
import type { Question } from '../lib/types';

const MIN_VOTES_FOR_CONSENSUS = 5;
const VOTE_STORAGE_PREFIX = 'cracklist_diff_vote:';

type Rating = 'Easy' | 'Medium' | 'Hard';
const RATINGS: Rating[] = ['Easy', 'Medium', 'Hard'];

/**
 * Community-perceived-difficulty widget. Shows the consensus tally when
 * there's enough signal to be meaningful, plus a one-tap vote row. The
 * localStorage guard is deliberately lightweight — this is a signal not a
 * ballot; real abuse is rate-limited server-side on the write route.
 */
export function CommunityDifficulty({ question, onVote }: {
  question: Question;
  onVote: (updated: Question) => void;
}) {
  const easy = question.perceivedEasy ?? 0;
  const medium = question.perceivedMedium ?? 0;
  const hard = question.perceivedHard ?? 0;
  const total = easy + medium + hard;

  const storageKey = VOTE_STORAGE_PREFIX + question.id;
  const [voted, setVoted] = useState<Rating | null>(null);
  const [saving, setSaving] = useState(false);
  const [voteError, setVoteError] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'Easy' || stored === 'Medium' || stored === 'Hard') setVoted(stored);
      else setVoted(null);
    } catch {
      setVoted(null);
    }
  }, [storageKey]);

  function vote(r: Rating) {
    if (voted) return;
    setSaving(true);
    setVoteError(false);
    // Set localStorage first — optimistic guard so a very fast double-click
    // doesn't fire two POSTs. The server-side rate limiter is the real
    // backstop, this just avoids the accidental double-vote.
    try { localStorage.setItem(storageKey, r); } catch { /* private mode */ }
    setVoted(r);
    api
      .voteDifficulty(question.id, r)
      .then((updated) => onVote(adaptQuestion(updated)))
      .catch(() => {
        // Roll back the localStorage guard so the user can retry.
        try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
        setVoted(null);
        setVoteError(true);
      })
      .finally(() => setSaving(false));
  }

  // If we have a meaningful sample, pick the leader for the consensus line.
  let consensus: { rating: Rating; pct: number } | null = null;
  if (total >= MIN_VOTES_FOR_CONSENSUS) {
    const counts: Array<[Rating, number]> = [['Easy', easy], ['Medium', medium], ['Hard', hard]];
    const [rating, count] = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
    consensus = { rating, pct: Math.round((count / total) * 100) };
  }

  const lcLabel = question.difficulty;
  const consensusDisagreesWithLC = consensus && lcLabel && consensus.rating !== lcLabel;

  return (
    <div style={{ marginTop: 24, marginBottom: 24, fontSize: 13 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>Community difficulty</div>

      {consensus ? (
        <div style={{ marginBottom: 12, lineHeight: 1.55 }}>
          {lcLabel && (
            <span style={{ opacity: 0.7 }}>LC label: <b>{lcLabel}</b>. </span>
          )}
          <span>
            {consensusDisagreesWithLC ? 'Community says ' : 'Community agrees: '}
            <b>{consensus.rating}</b> ({consensus.pct}% of {total} votes)
          </span>
        </div>
      ) : (
        <div style={{ marginBottom: 12, opacity: 0.65 }}>
          {total === 0
            ? 'No community votes yet — be the first.'
            : `${total} of ${MIN_VOTES_FOR_CONSENSUS} votes needed to show a consensus.`}
        </div>
      )}

      {total > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          <span>E {easy}</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>M {medium}</span>
          <span style={{ opacity: 0.35 }}>·</span>
          <span>H {hard}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            className="btn btn-secondary"
            disabled={!!voted}
            onClick={() => vote(r)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              flex: 1,
              opacity: voted && voted !== r ? 0.45 : 1,
              borderColor: voted === r ? 'var(--color-accent)' : undefined,
              color: voted === r ? 'var(--color-accent)' : undefined,
            }}
          >
            {voted === r ? '✓ ' : ''}{r}
          </button>
        ))}
      </div>
      {voted && (
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 6, fontFamily: 'var(--font-mono)' }}>
          {saving ? 'Saving your vote…' : 'Vote saved — this device'}
        </div>
      )}
      {voteError && <p role="alert" style={{ color: '#9b4044', fontSize: 12 }}>Your vote wasn’t saved. Please try again.</p>}
    </div>
  );
}
