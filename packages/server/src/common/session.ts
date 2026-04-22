import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'bgo_session';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_MS,
    path: '/',
  });
}

export function readSessionToken(req: Request): string | null {
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  if (fromCookie) return fromCookie;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length);
  return null;
}
