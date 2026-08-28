import { useState, type FormEvent } from 'react';
import { Nav } from '../components/Nav';
import { Corners } from '../components/Blueprint';
import { useStore } from '../lib/store';
import type { RoleLevel, RoundType } from '../lib/types';
import './Contribute.css';

const ROLE_OPTS: RoleLevel[] = ['Intern', 'SDE-1', 'SDE-2', 'SDE-3', 'Senior', 'Other'];
const ROUND_OPTS: RoundType[] = ['OA', 'Phone screen', 'Tech-1', 'Tech-2', 'Tech-3', 'HR', 'Other'];

export default function Contribute() {
  const { companies, submitStructured, submitPdf } = useStore();

  const [handle, setHandle] = useState('@ananya_r');
  const [email, setEmail] = useState('');
  const [companySlug, setCompanySlug] = useState('amazon');
  const [roleLevel, setRoleLevel] = useState<RoleLevel>('SDE-1');
  const [roundType, setRoundType] = useState<RoundType>('Tech-2');
  const [askedMonthYear, setAskedMonthYear] = useState('Mar 2026');
  const [title, setTitle] = useState('Given a stream of integers, find the running median.');
  const [sourceUrl, setSourceUrl] = useState('https://github.com/…/interview-log');
  const [tags, setTags] = useState<string[]>(['heap', 'streaming']);
  const [tagDraft, setTagDraft] = useState('');
  const [structuredSubmitted, setStructuredSubmitted] = useState(false);

  const [pdfEmail, setPdfEmail] = useState('');
  const [fileName, setFileName] = useState('');
  const [note, setNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const [pdfSubmitted, setPdfSubmitted] = useState(false);

  function addTag() {
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagDraft('');
  }

  function handleStructuredSubmit(e: FormEvent) {
    e.preventDefault();
    submitStructured({ handle, companySlug, roleLevel, roundType, title, askedMonthYear, sourceUrl, tags });
    setStructuredSubmitted(true);
    setTitle('');
    setSourceUrl('');
    setTags([]);
  }

  function handlePdfSubmit(e: FormEvent) {
    e.preventDefault();
    submitPdf({ email: pdfEmail, filename: fileName || 'submission.pdf', note });
    setPdfSubmitted(true);
    setFileName('');
    setNote('');
  }

  return (
    <div className="page-shell">
      <Nav />

      <div className="contribute-intro">
        <div className="kicker">Contribute</div>
        <h1>Add a question you were asked.</h1>
        <p>
          Two ways in. If you have a link and can fill four fields, use the structured path — it enters the moderation
          queue directly. If you have a PDF or a screenshot dump, use the file path — Rohan handles the extraction.
        </p>
      </div>

      <div className="contribute-grid">
        {/* PATH 1 */}
        <form className="blueprint contribute-path" onSubmit={handleStructuredSubmit}>
          <Corners />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div className="kicker" style={{ color: 'var(--color-accent)' }}>Path 01 · Structured</div>
            <div className="tag tag-outline">recommended</div>
          </div>
          <h2>Fill four fields.</h2>
          <p>Enters the pending queue → reviewed by a moderator → auto-message on outcome.</p>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Your handle</label>
            <input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email · for status updates</label>
            <input className="input" type="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="field">
              <label>Company</label>
              <select className="input" value={companySlug} onChange={(e) => setCompanySlug(e.target.value)}>
                {companies.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Role level</label>
              <select className="input" value={roleLevel} onChange={(e) => setRoleLevel(e.target.value as RoleLevel)}>
                {ROLE_OPTS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div className="field">
              <label>Round</label>
              <select className="input" value={roundType} onChange={(e) => setRoundType(e.target.value as RoundType)}>
                {ROUND_OPTS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Asked (month · year)</label>
              <input className="input" value={askedMonthYear} onChange={(e) => setAskedMonthYear(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Question title</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label>Source URL</label>
            <input className="input" placeholder="https://…" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 20 }}>
            <label>Topic tags</label>
            <div className="tag-input">
              {tags.map((t) => (
                <span className="tag tag-accent" key={t}>
                  {t} <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} style={{ background: 'none', color: 'inherit', marginLeft: 4 }}>×</button>
                </span>
              ))}
              <input
                placeholder="+ add tag"
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block blueprint" style={{ padding: 14 }}>
            Submit for review
            <Corners />
          </button>
          {structuredSubmitted ? (
            <div className="submitted-banner" style={{ marginTop: 10 }}>✓ Submitted — it's in the moderation queue now. Avg review time is under 24 hours.</div>
          ) : (
            <div style={{ fontSize: 11, textAlign: 'center', opacity: 0.55, marginTop: 10, fontFamily: 'var(--font-mono)' }}>
              avg review time · under 24 hours
            </div>
          )}
        </form>

        {/* PATH 2 */}
        <form className="blueprint contribute-path" style={{ display: 'flex', flexDirection: 'column' }} onSubmit={handlePdfSubmit}>
          <Corners />
          <div className="kicker" style={{ color: 'var(--color-accent)', marginBottom: 4 }}>Path 02 · PDF · Manual bridge</div>
          <h2>Just send the file.</h2>
          <p>Lands in Rohan's inbox, not the database. A moderator extracts questions by hand. Zero structured fields.</p>

          <div className="field" style={{ marginBottom: 14 }}>
            <label>Email</label>
            <input className="input" type="email" placeholder="you@college.edu" value={pdfEmail} onChange={(e) => setPdfEmail(e.target.value)} required />
          </div>

          <label
            className={`blueprint dropzone${dragging ? ' dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) setFileName(f.name);
            }}
          >
            <Corners />
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')} />
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-accent)', marginBottom: 14 }}>
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6" />
              <path d="M12 18v-6M9 15l3-3 3 3" />
            </svg>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, marginBottom: 6 }}>
              {fileName || 'Drop a PDF here'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {fileName ? 'click to change file' : 'or click to attach · placement docs, WhatsApp exports, screenshots ok · up to 20 MB'}
            </div>
          </label>

          <div className="field" style={{ marginBottom: 20 }}>
            <label>Optional · note to the moderator</label>
            <textarea className="input" placeholder="Which company this is for, roughly when, anything odd about the file…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <button type="submit" className="btn btn-secondary btn-block blueprint" style={{ padding: 14, marginTop: 'auto' }}>
            Send to inbox
            <Corners />
          </button>
          {pdfSubmitted ? (
            <div className="submitted-banner" style={{ marginTop: 10 }}>✓ Sent — you'll get an email once a moderator extracts it.</div>
          ) : (
            <div style={{ fontSize: 11, textAlign: 'center', opacity: 0.55, marginTop: 10, fontFamily: 'var(--font-mono)' }}>
              manual pipeline · you'll get an email when extracted
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
