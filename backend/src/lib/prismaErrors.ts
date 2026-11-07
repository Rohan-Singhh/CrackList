// Prisma's typed error codes, checked structurally so callers don't need to
// import the runtime error classes (and tests can throw plain objects).
function hasCode(e: unknown, code: string): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === code;
}

/** Unique-constraint violation (e.g. a racing duplicate idempotency key). */
export const isUniqueViolation = (e: unknown) => hasCode(e, 'P2002');

/**
 * `update` matched no row. With a non-unique filter in `where` (e.g.
 * `{ id, status: 'approved' }`) this also means "row exists but is in the
 * wrong state", which is how the state-guarded writes below use it.
 */
export const isRecordNotFound = (e: unknown) => hasCode(e, 'P2025');
