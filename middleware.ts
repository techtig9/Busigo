import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/help",
  "/pricing",
  "/terms",
  "/privacy",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Design-system gallery and any other /dev/* QA surface. Double-gated: the pages
  // themselves notFound() when NODE_ENV === "production" (see app/dev/design-system/page.tsx),
  // and this allowance is itself dev-only, so neither half can expose them on a real deploy.
  // They render no user data — the point is to review components without a Supabase session.
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/dev/")) return true;
  if (pathname.startsWith("/form/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/hook/")) return true;
  if (pathname.startsWith("/api/form/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/webhooks/")) return true;
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });
  const { pathname } = request.nextUrl;

  // No Supabase credentials configured (a marketing-only preview, or a clone before
  // .env.local is filled in). Constructing a client from undefined values throws on EVERY
  // request, so the whole site 500s -- including the public pages that need no database.
  //
  // Degrade FAIL-CLOSED instead: public routes render normally, and everything else is sent
  // to /login. Nothing auth-gated is ever served, so a misconfigured production deploy is
  // visibly broken for signed-in surfaces rather than silently open.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (isPublicPath(pathname)) return response;
    const url = new URL("/login", request.url);
    url.searchParams.set("unconfigured", "1");
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Refresh the session if it exists — keeps auth cookies alive across navigations.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // The actual enforcement boundary for MFA step-up (Master Spec section 7). A verified
  // authenticator factor doesn't stop Supabase from issuing a normal session on password
  // sign-in — it's issued at AAL1 regardless. LoginForm's redirect to /mfa-challenge right
  // after sign-in is just UX; this check is what stops someone from bypassing that screen by
  // navigating straight to a protected URL. currentLevel !== nextLevel means a verified
  // factor exists on the account but this session hasn't completed the challenge yet.
  if (user && pathname !== "/mfa-challenge") {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel !== aal.nextLevel) {
      return NextResponse.redirect(new URL("/mfa-challenge", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
