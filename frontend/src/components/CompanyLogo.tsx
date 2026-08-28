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

export function CompanyLogo({ name, size = 28 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false);

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
      src={`https://unavatar.io/${guessDomain(name)}?fallback=false`}
      alt=""
      width={size}
      height={size}
      className="company-logo-img"
      onError={() => setFailed(true)}
    />
  );
}
