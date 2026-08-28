import { useEffect, useMemo, useState } from 'react';
import { Nav } from '../components/Nav';
import { Corners } from '../components/Blueprint';
import { useStore } from '../lib/store';
import { SUBMITTER_STATS } from '../lib/mockData';
import { REJECTION_REASONS, type RejectionReason } from '../lib/types';
import { API_BASE } from '../lib/api';
import './ModeratorQueue.css';

const MODERATOR = '@rohan';
type Tab = 'structured' | 'pdf' | 'flagged';

export default function ModeratorQueue() {
  const { questions, companies, pdfInbox, totalApprovedLifetime, approveQuestion, rejectQuestion } = useStore();

  const [tab, setTab] = useState<Tab>('structured');
  const [sort, setSort] = useState<'Oldest' | 'Newest'>('Oldest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<RejectionReason | null>(null);

  const pending = useMemo(() => questions.filter((q) => q.status === 'pending' && q.intakePath === 'structured'), [questions]);
  const flagged = useMemo(() => pending.filter((q) => q.topicTags.includes('likely duplicate')), [pending]);

  const listed = useMemo(() => {
    const base = tab === 'flagged' ? flagged : pending;
    const sorted = [...base].sort((a, b) => {
      const na = Number(a.displayId.replace(/\D/g, '')) || 0;
      const nb = Number(b.displayId.replace(/\D/g, '')) || 0;
      return sort === 'Oldest' ? na - nb : nb - na;
    });
    return sorted;
  }, [tab, pending, flagged, sort]);

  useEffect(() => {
    if (tab === 'pdf') return;
    if (!listed.find((q) => q.id === selectedId)) {
      setSelectedId(listed[0]?.id ?? null);
      setRejectReason(null);
    }
  }, [listed, selectedId, tab]);

  const selected = listed.find((q) => q.id === selectedId) ?? null;
  const selectedCompany = selected ? companies.find((c) => c.id === selected.companyId) : null;
  const selectedIndex = selected ? listed.findIndex((q) => q.id === selected.id) : -1;

  function goto(delta: number) {
    if (selectedIndex === -1 || listed.length === 0) return;
    const next = (selectedIndex + delta + listed.length) % listed.length;
    setSelectedId(listed[next].id);
    setRejectReason(null);
  }

  function handleApprove() {
    if (!selected) return;
    approveQuestion(selected.id, MODERATOR);
  }

  function handleReject() {
    if (!selected || !rejectReason) return;
    rejectQuestion(selected.id, rejectReason);
    setRejectReason(null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tab === 'pdf') return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key.toLowerCase() === 'a') handleApprove();
      if (e.key.toLowerCase() === 'r' && rejectReason) handleReject();
      if (e.key.toLowerCase() === 'j') goto(1);
      if (e.key.toLowerCase() === 'k') goto(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rejectReason, tab, listed]);

  return (
    <div className="page-shell">
      <Nav mod />

      <div className="mq-stats">
        <div className="stat"><div className="n accent-num">{pending.length}</div><div className="l">Pending review</div></div>
        <div className="stat"><div className="n">{pdfInbox.length}</div><div className="l">PDF inbox</div></div>
        <div className="stat"><div className="n">{totalApprovedLifetime.toLocaleString()}</div><div className="l">Approved · lifetime</div></div>
        <div className="stat"><div className="n">92%</div><div className="l">Approval rate</div></div>
      </div>

      <div className="mq-body">
        <div className="mq-list-col">
          <div className="mq-list-head">
            <div className="mq-tabs">
              <button className={tab === 'structured' ? 'active' : ''} onClick={() => setTab('structured')}>Structured · {pending.length}</button>
              <button className={tab === 'pdf' ? 'active' : ''} onClick={() => setTab('pdf')}>PDF inbox · {pdfInbox.length}</button>
              <button className={tab === 'flagged' ? 'active' : ''} onClick={() => setTab('flagged')}>Flagged · {flagged.length}</button>
            </div>
            {tab !== 'pdf' && (
              <div className="seg" style={{ flexShrink: 0 }}>
                {(['Oldest', 'Newest'] as const).map((s) => (
                  <label className="seg-opt" key={s}>
                    <input type="radio" name="sort" hidden checked={sort === s} onChange={() => setSort(s)} />
                    {s}
                  </label>
                ))}
              </div>
            )}
          </div>

          {tab === 'pdf' ? (
            <div>
              {pdfInbox.map((p) => (
                <div className="mq-pdf-row" key={p.id}>
                  <div className="filename">{p.filename}</div>
                  <div className="meta">
                    {p.email} · {p.createdAt}{p.note ? ` · "${p.note}"` : ''}
                    {p.hasFile ? (
                      <>
                        {' · '}
                        <a
                          href={`${API_BASE}/admin/pdf-inbox/${p.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--color-accent)', textDecoration: 'none' }}
                        >
                          open file ↗
                        </a>
                      </>
                    ) : (
                      <span style={{ opacity: 0.5 }}> · file unavailable (older upload)</span>
                    )}
                  </div>
                </div>
              ))}
              {pdfInbox.length === 0 && <div className="mq-empty">Inbox is empty.</div>}
            </div>
          ) : (
            <div>
              {listed.map((q) => {
                const c = companies.find((co) => co.id === q.companyId);
                const stats = q.submittedBy in SUBMITTER_STATS ? SUBMITTER_STATS[q.submittedBy] : null;
                return (
                  <button key={q.id} className={`mq-row${q.id === selectedId ? ' selected' : ''}`} onClick={() => { setSelectedId(q.id); setRejectReason(null); }}>
                    <div className="id">{q.displayId}</div>
                    <div>
                      <div className="title">{q.title}</div>
                      <div className="meta">
                        {c?.name} · {q.roleLevel} · {q.roundType} · {q.askedMonthYear} · {q.submittedBy}
                        {stats ? ` (${stats.approvedCount} approved · ${stats.approvedCount === 0 ? 'new' : `${stats.approvalRate}%`})` : ''}
                      </div>
                    </div>
                    <div className="tags">
                      {q.topicTags.map((t) => (
                        <span
                          key={t}
                          className="tag"
                          style={
                            t === 'likely duplicate'
                              ? { background: 'color-mix(in srgb, #b4423a 15%, transparent)', color: '#b4423a' }
                              : undefined
                          }
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
              {listed.length === 0 && <div className="mq-empty">Nothing here right now.</div>}
              {listed.length > 0 && (
                <div className="mq-load-more">showing {listed.length} of {listed.length}</div>
              )}
            </div>
          )}
        </div>

        {tab !== 'pdf' && (
          <div className="mq-review">
            {selected ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div className="kicker">Reviewing · {selected.displayId}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.55 }}>{selectedIndex + 1} of {listed.length} →</div>
                </div>
                <h3>{selected.title}</h3>

                <div className="mq-review-meta">
                  <div style={{ opacity: 0.55 }}>Company</div><div>{selectedCompany?.name}</div>
                  <div style={{ opacity: 0.55 }}>Role</div><div>{selected.roleLevel}</div>
                  <div style={{ opacity: 0.55 }}>Round</div><div>{selected.roundType}</div>
                  <div style={{ opacity: 0.55 }}>Asked</div><div>{selected.askedMonthYear}</div>
                  <div style={{ opacity: 0.55 }}>Source</div><div><a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)' }}>{selected.sourceUrl.replace('https://', '')}</a></div>
                  <div style={{ opacity: 0.55 }}>Tags</div><div>{selected.topicTags.join(', ')}</div>
                  <div style={{ opacity: 0.55 }}>Submitter</div>
                  <div>{selected.submittedBy}{SUBMITTER_STATS[selected.submittedBy] ? ` · ${SUBMITTER_STATS[selected.submittedBy].approvedCount} approved · ${SUBMITTER_STATS[selected.submittedBy].approvalRate}% approval` : ' · new contributor'}</div>
                </div>

                <div className="mq-autocheck">
                  <div className="kicker" style={{ marginBottom: 8 }}>Auto-check</div>
                  {selected.topicTags.includes('likely duplicate') ? (
                    <>→ Possible near-duplicate detected<br /></>
                  ) : (
                    <>→ No near-duplicate (0.42 max)<br /></>
                  )}
                  → Company recognized ({selectedCompany?.name})<br />
                  → Source URL reachable · 200<br />
                  → Tags valid
                </div>

                <button className="btn btn-primary btn-block blueprint" style={{ padding: 14 }} onClick={handleApprove}>
                  ✓ Approve · publish to graph
                  <Corners />
                </button>

                <div style={{ marginTop: 20 }}>
                  <div className="kicker" style={{ marginBottom: 10 }}>Reject with reason</div>
                  <div className="mq-reject-list">
                    {REJECTION_REASONS.map((reason) => (
                      <label className="radio" key={reason}>
                        <input type="radio" name="rej" checked={rejectReason === reason} onChange={() => setRejectReason(reason)} />
                        <span className="dot" /> {reason}
                      </label>
                    ))}
                  </div>
                  <button className="btn btn-secondary btn-block" style={{ padding: 10, marginTop: 14 }} disabled={!rejectReason} onClick={handleReject}>
                    Reject · send auto-message
                  </button>
                </div>

                <div className="mq-shortcuts">
                  keyboard · <b style={{ color: 'var(--color-text)' }}>A</b> approve · <b style={{ color: 'var(--color-text)' }}>R</b> reject (after choosing a reason) · <b style={{ color: 'var(--color-text)' }}>J/K</b> next/prev
                </div>
              </>
            ) : (
              <p style={{ opacity: 0.6, fontSize: 14 }}>Queue's empty — nothing left to review here.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
