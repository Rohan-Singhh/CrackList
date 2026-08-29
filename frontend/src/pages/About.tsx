import { Link } from 'react-router-dom';
import { Nav } from '../components/Nav';
import { Blueprint, Corners } from '../components/Blueprint';
import { useStore } from '../lib/store';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import './About.css';

const STEPS = [
  {
    tag: 'Indexed',
    title: 'Bulk problem sets, tagged by company',
    body: 'Public company-wise problem lists get imported and tagged with difficulty, topics, and how often each one comes up.',
  },
  {
    tag: 'Structured',
    title: 'Fill four fields, straight to the queue',
    body: "Got asked something not on here? Submit company, role, round, and the question — it lands in the moderation queue directly.",
  },
  {
    tag: 'PDF / screenshot',
    title: 'Dump it, a moderator extracts it',
    body: 'Have a placement-group export or a screenshot pile? Drop the file — a moderator pulls the individual questions out by hand.',
  },
];

export default function About() {
  const { companies, totalApprovedLifetime, totalContributors } = useStore();
  useDocumentMeta('About — CrackList', 'How CrackList works: a free, community-run database of real interview questions with no signup and no paywall.');

  return (
    <div className="page-shell">
      <Nav />

      <div className="about-intro">
        <div className="kicker">About</div>
        <h1>A free, community-run interview question index.</h1>
        <p>
          CrackList exists so interview prep doesn't sit behind a paywall. Every question is tagged
          by company, sourced, and dated — either indexed from public problem sets or submitted by
          someone who was actually asked it.
        </p>
      </div>

      <div className="about-stats">
        <div className="stat"><div className="n accent-num">{totalApprovedLifetime.toLocaleString()}</div><div className="l">Questions</div></div>
        <div className="stat"><div className="n accent-num">{companies.length}</div><div className="l">Companies</div></div>
        <div className="stat"><div className="n accent-num">{totalContributors}</div><div className="l">Contributors</div></div>
        <div className="stat"><div className="n">100%</div><div className="l">Free · always</div></div>
      </div>

      <div className="about-section-heading">
        <h2>How a question gets in</h2>
      </div>
      <div className="about-steps">
        {STEPS.map((s, i) => (
          <Blueprint key={s.tag} className="about-step">
            <Corners />
            <div className="kicker" style={{ color: 'var(--color-accent)' }}>0{i + 1} · {s.tag}</div>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </Blueprint>
        ))}
      </div>

      <div className="about-bottom">
        <Blueprint className="about-principles">
          <div className="kicker" style={{ marginBottom: 10 }}>Principles</div>
          <ul>
            <li>Free, always — no premium tier</li>
            <li>Community-owned, MIT licensed, self-hostable</li>
            <li>Every question links back to its source</li>
            <li>No real names published on question pages</li>
          </ul>
        </Blueprint>

        <div className="about-cta">
          <h3>Know something we don't?</h3>
          <p>Four fields or a file drop — either way it's in the queue within minutes.</p>
          <Link to="/contribute" className="btn btn-primary blueprint" style={{ padding: '12px 22px', display: 'inline-flex' }}>
            Contribute a question
            <Corners />
          </Link>
        </div>
      </div>
    </div>
  );
}
