import { timingSafeEqual } from 'node:crypto';
import { GobbleError, HTTP_STATUS, type ErrorCode } from './engine';
import { serverStore } from './store/server';

const NO_STORE = { 'Cache-Control': 'no-store' };

export function ok(body: Record<string, unknown>, init: ResponseInit = {}) {
  return Response.json({ ok: true, ...body }, { ...init, headers: { ...NO_STORE, ...init.headers } });
}

export function fail(code: ErrorCode, message: string) {
  return Response.json({ ok: false, error: { code, message } }, { status: HTTP_STATUS[code], headers: NO_STORE });
}

export function failFrom(err: unknown) {
  if (err instanceof GobbleError) return fail(err.code, err.message);
  console.error(err);
  return Response.json(
    { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } },
    { status: 500, headers: NO_STORE },
  );
}

/**
 * Bearer check for write routes. With no GOBBLE_AGENT_TOKEN configured, writes are
 * allowed only against the local file store (a dev machine), never against Redis.
 */
export function authorized(req: Request): boolean {
  const expected = process.env.GOBBLE_AGENT_TOKEN;
  if (!expected) return serverStore().kind === 'file';
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new GobbleError('INVALID', 'Body must be JSON.');
  }
}

/** Base URL for board links: NEXT_PUBLIC_SITE_URL, else the request origin. */
export function siteUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}
