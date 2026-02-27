import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';

// next-intl routing middleware (handles locale detection & redirects)
const intlMiddleware = createMiddleware(routing);

export default function middleware(req: NextRequest): NextResponse {
    // ── Real IP logging ─────────────────────────────────────────────────────────
    // nginx forwards the real client IP via X-Real-IP (set_real_ip_from module)
    // or X-Forwarded-For. Log it so it appears in Next.js stdout.
    const ip =
        req.headers.get('x-real-ip') ||
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        'unknown';

    const ts = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Taipei' }).replace('T', ' ');
    console.log(`[${ts} | ${ip}] ${req.method} ${req.nextUrl.pathname}`);

    // ── Delegate to next-intl ───────────────────────────────────────────────────
    return intlMiddleware(req) as NextResponse;
}

export const config = {
    // Same matcher next-intl recommends — skip static assets, API routes, etc.
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
