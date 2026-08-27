import type { NextFunction, Request, Response } from 'express';

export const SESSION_COOKIE = 'askd_mod';

/**
 * Gate for all /admin/* mutating + inbox routes.
 * Auth is a signed httpOnly cookie set by POST /admin/login.
 * cookie-parser is initialized with SESSION_SECRET, so a tampered value
 * lands in req.cookies (unsigned) rather than req.signedCookies and is rejected.
 */
export function requireModerator(req: Request, res: Response, next: NextFunction) {
  const value = req.signedCookies?.[SESSION_COOKIE];
  if (value === 'ok') return next();
  return res.status(401).json({ error: 'Moderator session required' });
}
