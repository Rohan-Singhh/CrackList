import { NavLink } from 'react-router-dom';
import { Logo } from './Logo';

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  fontSize: 13,
  color: isActive ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-text) 70%, transparent)',
  textDecoration: 'none',
});

export function Nav({ mod = false }: { mod?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 28,
        padding: '16px 28px',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 20,
          letterSpacing: '.04em',
          marginRight: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ color: 'var(--color-accent)', display: 'flex' }}>
          <Logo />
        </span>
        <NavLink to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          CrackList
        </NavLink>
        {mod && (
          <span style={{ fontSize: 11, letterSpacing: '.15em', color: 'var(--color-accent)', marginLeft: 6 }}>MOD</span>
        )}
      </div>
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
  );
}
