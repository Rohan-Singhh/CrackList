import type { NextFunction, Request, Response } from 'express';

export const SESSION_COOKIE = 'cracklist_mod';

/**
 * Whether the caller holds a valid moderator session.
 * cookie-parser is initialized with SESSION_SECRET, so a tampered value
 * lands in req.cookies (unsigned) rather than req.signedCookies and is rejected.
 */
export function isModerator(req: Request): boolean {
  return req.signedCookies?.[SESSION_COOKIE] === 'ok';
}

/**
 * Gate for all /admin/* mutating + inbox routes.
 * Auth is a signed httpOnly cookie set by POST /admin/login.
 */
export function requireModerator(req: Request, res: Response, next: NextFunction) {
  if (isModerator(req)) return next();
  return res.status(401).json({ error: 'Moderator session required' });
}
