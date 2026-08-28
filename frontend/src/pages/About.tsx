import { Link } from 'react-router-dom';
import { Nav } from '../components/Nav';
import { Blueprint, Corners } from '../components/Blueprint';

export default function About() {
  return (
    <div className="page-shell">
      <Nav />
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 80px' }}>
        <div className="kicker" style={{ marginBottom: 12 }}>About</div>
        <h1 style={{ marginBottom: 20 }}>A free, community-run interview question index.</h1>
        <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.8, marginBottom: 16 }}>
          CrackList exists so interview prep doesn't sit behind a paywall. Every question is tagged
          by company, sourced, and dated — either indexed from public problem sets or submitted by
          someone who was actually asked it.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.7, opacity: 0.8, marginBottom: 32 }}>
          Two ways questions get in: a structured submission (goes straight to the moderation queue),
          or a PDF/screenshot dump a moderator extracts by hand. Nothing is scraped from paid sources.
        </p>

        <Blueprint style={{ padding: 24, marginBottom: 32 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>Principles</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.9, opacity: 0.85 }}>
            <li>Free, always — no premium tier</li>
            <li>Community-owned, MIT licensed, self-hostable</li>
            <li>Every question links back to its source</li>
          </ul>
        </Blueprint>

        <Link to="/contribute" className="btn btn-primary blueprint" style={{ padding: '12px 22px', display: 'inline-flex' }}>
          Contribute a question
          <Corners />
        </Link>
      </div>
    </div>
  );
}
