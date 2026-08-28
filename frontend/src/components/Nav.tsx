import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import { Logo } from './Logo';
import './Nav.css';

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  fontSize: 13,
  color: isActive ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text) 70%, transparent)',
  textDecoration: 'none',
});

export function Nav({ mod = false }: { mod?: boolean }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Route change should close the drawer (native <a> navigation doesn't fire
  // a real onClick before React Router intercepts it, and users tapping a
  // link expect the menu to shut).
  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <div className="nav">
      <div className="nav-brand">
        <span style={{ color: 'var(--color-accent)', display: 'flex' }}>
          <Logo />
        </span>
        <NavLink to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          CrackList
        </NavLink>
        {mod && <span className="nav-mod-badge">MOD</span>}
      </div>

      <button
        type="button"
        className={`nav-toggle${open ? ' open' : ''}`}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span></span>
        <span></span>
      </button>

      <div className={`nav-links${open ? ' open' : ''}`}>
        {mod ? (
          <>
            <NavLink to="/admin/queue" style={navLinkStyle}>Queue</NavLink>
            <span style={navLinkStyle({ isActive: false })}>Approved</span>
            <span style={navLinkStyle({ isActive: false })}>Rejected</span>
            <span style={navLinkStyle({ isActive: false })}>PDF inbox</span>
            <span style={navLinkStyle({ isActive: false })}>Contributors</span>
          </>
        ) : (
          <>
            <NavLink to="/" end style={navLinkStyle}>Browse</NavLink>
            <NavLink to="/contribute" style={navLinkStyle}>Contribute</NavLink>
            <NavLink
              to="/#trending"
              style={navLinkStyle}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                const el = document.getElementById('trending');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.location.href = '/#trending';
                }
              }}
            >
              Trending
            </NavLink>
            <NavLink to="/about" style={navLinkStyle}>About</NavLink>
          </>
        )}
      </div>
    </div>
  );
}
