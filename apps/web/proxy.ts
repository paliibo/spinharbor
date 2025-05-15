import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/favorites', '/recent', '/bonuses', '/loyalty', '/wallet', '/profile', '/settings', '/responsible-gaming', '/admin'];
const STAFF = new Set(['SUPPORT', 'OPERATOR', 'ADMIN']);

/**
 * Edge redirect for a better first paint on protected routes. It only *reads* the access cookie
 * (unverified) – every API request is verified and authorised server-side regardless.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('sh_access')?.value;
  const refresh = req.cookies.get('sh_refresh')?.value;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (isProtected && !token && !refresh) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith('/admin') && token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!STAFF.has(payload.role)) return NextResponse.redirect(new URL('/', req.url));
    } catch {
      /* let the client guard handle it */
    }
  }
  if ((pathname === '/login' || pathname === '/register') && token) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'] };
