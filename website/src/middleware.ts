import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware(routing);

const VALID_LOCALES = new Set(['en', 'ja', 'zh-TW']);

// Paths with file extensions that are real Next.js concerns (let pass through)
// Everything else with a dot is a scanner/bot probe — return 404 immediately
const REAL_ASSET_RE = /^\/(_next|api|favicon\.ico)/;

export default function middleware(req: NextRequest): NextResponse {
    const { pathname } = req.nextUrl;

    // ── Real IP logging ──────────────────────────────────────────────────────
    const ip =
        req.headers.get('x-real-ip') ||
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown';
    const ts = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    console.log(`[${ts} | ${ip}] ${req.method} ${pathname}`);

    // ── Block scanner probes with file extensions ────────────────────────────
    // e.g. /wp-login.php, /xmlrpc.php, /.env, /admin.asp, etc.
    // Static Next.js assets are handled before this middleware runs by default.
    if (/\.[a-zA-Z0-9]+$/.test(pathname) && !REAL_ASSET_RE.test(pathname)) {
        return new NextResponse(null, { status: 404 });
    }

    // ── Block invalid locale prefix (e.g. /wp-login.php treated as locale) ──
    const firstSegment = pathname.split('/')[1];
    if (firstSegment && !VALID_LOCALES.has(firstSegment) && firstSegment !== '') {
        // Let next-intl handle it — it will redirect to default locale
        // (which is correct behaviour for a real path like /ranking → /en/ranking)
    }

    return intlMiddleware(req) as NextResponse;
}

export const config = {
    // Include dotted paths too so we can intercept scanner probes
    matcher: ['/((?!_next|api|favicon\\.ico).*)'],
};
