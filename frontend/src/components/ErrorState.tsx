import { Blueprint, Corners } from './Blueprint';

/**
 * Shown when a fetch genuinely failed (network/server error) — never for a
 * legitimately empty result. Distinguishing the two matters: "0 companies"
 * or "no questions match" reads as "this site has no data," when the real
 * story is "we couldn't reach the server."
 */
export function ErrorState({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <Blueprint
      style={{
        padding: compact ? 20 : 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <Corners />
      <div style={{ fontSize: compact ? 13 : 14, opacity: 0.8 }}>
        Couldn't reach the server. Might be waking up (free hosting sleeps when idle) — try again in a moment.
      </div>
      <button className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }} onClick={onRetry}>
        Try again
      </button>
    </Blueprint>
  );
}
