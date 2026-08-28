import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { CompanyLogo } from './CompanyLogo';

const INITIAL_SHOWN = 12;

interface Row {
  questionId: string;
  companyName: string;
  companySlug: string;
}

/**
 * "Also asked at" — turns a single question into a cross-company view.
 * The same LeetCode problem appears at many companies (some 100+), and
 * LC Premium sells that per-problem company list for money. We already
 * have every (question, company) row in the DB, so the data's free.
 */
export function AlsoAskedAt({ questionId, currentCompanyId }: { questionId: string; currentCompanyId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(false);
    setShowAll(false);
    api
      .alsoAskedAt(questionId)
      .then((data) => {
        if (!alive) return;
        // Filter out the current company defensively (the backend already
        // excludes the current row by id, but not other rows for the same
        // company/question, which we don't want to show either).
        setRows(data.filter((r) => r.companySlug && r.companyName));
      })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [questionId, currentCompanyId]);

  if (error) return null; // silent — this is a nice-to-have, not core
  if (rows === null) {
    return (
      <div style={{ marginTop: 28, fontSize: 12, opacity: 0.55 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>Also asked at</div>
        Loading…
      </div>
    );
  }
  if (rows.length === 0) return null;

  const visible = showAll ? rows : rows.slice(0, INITIAL_SHOWN);

  return (
    <div style={{ marginTop: 28 }}>
      <div className="kicker" style={{ marginBottom: 10 }}>
        Also asked at · {rows.length} {rows.length === 1 ? 'company' : 'companies'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {visible.map((r) => (
          <Link
            key={r.questionId}
            to={`/q/${r.questionId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px 4px 6px',
              border: '1px solid var(--color-divider)',
              color: 'inherit',
              textDecoration: 'none',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
            }}
            title={`Open the ${r.companyName} version`}
          >
            <CompanyLogo name={r.companyName} size={16} />
            {r.companyName}
          </Link>
        ))}
      </div>
      {!showAll && rows.length > INITIAL_SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="btn btn-secondary"
          style={{ marginTop: 10, padding: '6px 12px', fontSize: 12 }}
        >
          Show {rows.length - INITIAL_SHOWN} more
        </button>
      )}
    </div>
  );
}
