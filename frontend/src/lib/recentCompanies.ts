const KEY = 'cracklist_recent_companies';
export function recentCompanySlugs(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((slug): slug is string => typeof slug === 'string').slice(0, 4)
      : [];
  } catch {
    return [];
  }
}
export function rememberCompany(slug: string) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify([slug, ...recentCompanySlugs().filter((value) => value !== slug)].slice(0, 4)),
    );
  } catch {
    /* Browsing remains usable when browser storage is unavailable. */
  }
}
