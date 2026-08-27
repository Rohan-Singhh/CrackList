import { Router } from 'express';
import { SESSION_COOKIE } from '../middleware/requireModerator.js';

export const authRouter = Router();

const isProd = process.env.NODE_ENV === 'production';
const cookieOpts = {
  httpOnly: true,
  signed: true,
  sameSite: 'lax' as const,
  secure: isProd,
  maxAge: 1000 * 60 * 60 * 8, // 8h
  path: '/',
};

// POST /admin/login { password } -> sets signed httpOnly session cookie
authRouter.post('/login', (req, res) => {
  const { password } = req.body ?? {};
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSWORD not configured' });
  if (typeof password !== 'string' || password !== expected) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  res.cookie(SESSION_COOKIE, 'ok', cookieOpts);
  return res.json({ ok: true });
});

// POST /admin/logout -> clears the session cookie
authRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  return res.json({ ok: true });
});

// GET /admin/session -> whether the caller currently holds a moderator session
authRouter.get('/session', (req, res) => {
  res.json({ authenticated: req.signedCookies?.[SESSION_COOKIE] === 'ok' });
});
