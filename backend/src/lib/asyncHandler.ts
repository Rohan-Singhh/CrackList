import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 doesn't catch rejected promises from async handlers — an
 * unhandled rejection there crashes the whole Node process (default since
 * Node 15), not just the one request. Wrap every async route in this so a
 * DB hiccup returns a 500 instead of taking the entire server down.
 */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
