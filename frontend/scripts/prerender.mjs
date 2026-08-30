// Post-build SEO prerender. CrackList is a client-rendered SPA, so out of
// the box every one of its ~17k question pages and ~427 company pages is
// invisible to crawlers (they see `<div id="root"></div>` and nothing else).
// This script runs after `vite build` and, for each real route, writes a
// static HTML file with a proper <title>/description/canonical/OG tags and
// a lightweight server-rendered content snapshot, so search engines get
// real per-page content without needing a full SSR/hydration rewrite.
// The client bundle is untouched — React mounts into #root exactly as
// before and takes over immediately.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');
const API_BASE = (process.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const SITE_URL = (process.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function truncate(s, n) {
  const str = String(s ?? '');
  return str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str;
}

// ponytail: Render free-tier dynos cold-start (or blip) into a 502 under
// load. A few retries ride that out; upgrade to a wake-up ping before build
// if it's still flaky.
async function fetchJson(path, attempts = 3) {
  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(`${API_BASE}${path}`);
    if (res.ok) return res.json();
    if (i === attempts) throw new Error(`${path} -> ${res.status}`);
    await new Promise((r) => setTimeout(r, 5000 * i));
  }
}

function renderPage(template, { path, title, description, snapshot }) {
  const canonical = `${SITE_URL}${path}`;
  const extraTags = `
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
  </head>`;
  let html = template
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*\/?>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace('</head>', extraTags);
  html = html.replace('<div id="root"></div>', `<div id="root">${snapshot}</div>`);
  return html;
}

async function writeRoute(routePath, html) {
  const outDir = routePath === '/' ? DIST : resolve(DIST, `.${routePath}`);
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, 'index.html'), html, 'utf8');
}

async function main() {
  const template = await readFile(resolve(DIST, 'index.html'), 'utf8');

  console.log('Fetching companies + questions from', API_BASE);
  const [companies, questions] = await Promise.all([
    fetchJson('/companies'),
    fetchJson('/questions/sitemap-data'),
  ]);
  console.log(`  ${companies.length} companies, ${questions.length} questions`);

  const urls = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/about', changefreq: 'monthly', priority: '0.3' },
    { loc: '/contribute', changefreq: 'monthly', priority: '0.5' },
  ];

  // ---- Homepage ----
  {
    const description = `Free, community-run database of ${questions.length.toLocaleString()} real interview questions asked at ${companies.length} companies. No signup, no paywall.`;
    const snapshot = `
      <h1>CrackList — real interview questions, by company</h1>
      <p>${escapeHtml(description)}</p>
      <ul>
        ${companies.map((c) => `<li><a href="/c/${escapeHtml(c.slug)}">${escapeHtml(c.name)} (${c.questionCount})</a></li>`).join('\n')}
      </ul>`;
    const html = renderPage(template, {
      path: '/',
      title: 'CrackList — Free Interview Questions by Company',
      description,
      snapshot,
    });
    await writeRoute('/', html);
  }

  // ---- Company pages ----
  const questionsByCompany = new Map();
  for (const q of questions) {
    if (!questionsByCompany.has(q.companySlug)) questionsByCompany.set(q.companySlug, []);
    questionsByCompany.get(q.companySlug).push(q);
  }
  for (const c of companies) {
    const mine = questionsByCompany.get(c.slug) ?? [];
    const description = `${c.questionCount} real interview question${c.questionCount === 1 ? '' : 's'} asked at ${c.name}, shared by the community. Free, no signup.`;
    const snapshot = `
      <h1>${escapeHtml(c.name)} interview questions</h1>
      <p>${escapeHtml(description)}</p>
      <ul>
        ${mine.map((q) => `<li><a href="/q/${q.id}">${escapeHtml(truncate(q.questionText, 120))}</a>${q.difficulty ? ` — ${escapeHtml(q.difficulty)}` : ''}</li>`).join('\n')}
      </ul>`;
    const html = renderPage(template, {
      path: `/c/${c.slug}`,
      title: `${c.name} Interview Questions — CrackList`,
      description,
      snapshot,
    });
    await writeRoute(`/c/${c.slug}`, html);
    urls.push({ loc: `/c/${c.slug}`, changefreq: 'weekly', priority: '0.8' });
  }
  console.log(`  wrote ${companies.length} company pages`);

  // ---- Question pages ----
  let written = 0;
  for (const q of questions) {
    const title = truncate(q.questionText, 60);
    const description = `Asked at ${q.companyName}${q.roleLevel && q.roleLevel !== 'Other' ? ` for ${q.roleLevel}` : ''}${q.roundType && q.roundType !== 'Other' ? ` (${q.roundType} round)` : ''}.${q.difficulty ? ` Difficulty: ${q.difficulty}.` : ''} See how others solved it, free on CrackList.`;
    const snapshot = `
      <h1>${escapeHtml(q.questionText)}</h1>
      <p>Asked at <a href="/c/${escapeHtml(q.companySlug)}">${escapeHtml(q.companyName)}</a>
        ${q.roleLevel && q.roleLevel !== 'Other' ? ` · ${escapeHtml(q.roleLevel)}` : ''}
        ${q.roundType && q.roundType !== 'Other' ? ` · ${escapeHtml(q.roundType)}` : ''}
        ${q.difficulty ? ` · ${escapeHtml(q.difficulty)}` : ''}
      </p>`;
    const html = renderPage(template, {
      path: `/q/${q.id}`,
      title: `${title} — ${q.companyName} Interview Question`,
      description,
      snapshot,
    });
    await writeRoute(`/q/${q.id}`, html);
    urls.push({ loc: `/q/${q.id}`, changefreq: 'monthly', priority: '0.6', lastmod: q.createdAt.slice(0, 10) });
    written += 1;
  }
  console.log(`  wrote ${written} question pages`);

  // ---- sitemap.xml + robots.txt ----
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
  await writeFile(resolve(DIST, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE_URL}/sitemap.xml
`;
  await writeFile(resolve(DIST, 'robots.txt'), robots, 'utf8');

  console.log(`Prerender done: ${urls.length} URLs in sitemap.xml`);
}

main().catch((err) => {
  console.error('Prerender failed:', err);
  // ponytail: CI only needs tsc/vite build to pass (that's what actually
  // catches regressions); the real prerender for prod runs on Vercel's own
  // build, which fails loudly as before. Don't block merges on a Render
  // free-dyno blip.
  if (process.env.CI) {
    console.warn('Running in CI — skipping prerender, shipping unprerendered dist/index.html.');
    process.exit(0);
  }
  process.exit(1);
});
