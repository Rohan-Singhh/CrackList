import { useState } from 'react';

// Best-effort: guess a company's domain from its name and pull a logo from
// unavatar.io (aggregates Clearbit/Google/etc., ?fallback=false makes it 404
// instead of returning a generic placeholder). No API key, no lookup table —
// just falls back to the initial-letter badge when the guess is wrong or 404s.
function guessDomain(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[.,'&]/g, '')
    .replace(/\s+(inc|labs|systems|technologies|group)\.?$/i, '')
    .replace(/\s+/g, '');
  return `${slug}.com`;
}

// Failures are remembered for the session, not just for one mounted tile.
// The homepage renders 400+ of these; without this, every navigation back to
// the grid re-requested every domain we already know 404s.
const failedDomains = new Set<string>();

export function CompanyLogo({ name, size = 28 }: { name: string; size?: number }) {
  const domain = guessDomain(name);
  const [failed, setFailed] = useState(() => failedDomains.has(domain));

  if (failed) {
    return (
      <div
        className="company-logo-fallback"
        style={{ width: size, height: size, fontSize: size * 0.45 }}
      >
        {name[0]}
      </div>
    );
  }

  return (
    <img
      src={`https://unavatar.io/${domain}?fallback=false`}
      alt=""
      width={size}
      height={size}
      // The company grid is one image per tile, far more than fit on screen.
      // Lazy + async keeps offscreen tiles off the critical path and stops
      // decodes from blocking the main thread while the user scrolls.
      loading="lazy"
      decoding="async"
      className="company-logo-img"
      onError={() => {
        failedDomains.add(domain);
        setFailed(true);
      }}
    />
  );
}
