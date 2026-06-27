import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/admin') || req.nextUrl.pathname.startsWith('/create');
  const isAuthRoute = req.nextUrl.pathname.startsWith('/auth/signin');

  if (isProtectedRoute && !isLoggedIn) {
    const signInUrl = new URL('/auth/signin', req.nextUrl);
    signInUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL('/', req.nextUrl));
  }

  // Prevent browser from caching protected pages (fixes back button after signout)
  if (isProtectedRoute && isLoggedIn) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  return NextResponse.next();
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
