"use client";

import { useEffect } from "react";
import Link from "next/link";

// Next.js App Router convention: a root-level error boundary. Must be a Client Component.
// Catches rendering errors anywhere in the public site that aren't caught by a more specific
// error.tsx (like the dashboard's own, below).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center font-sans">
        <p className="text-sm font-semibold text-danger">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">This page hit an unexpected error</h1>
        <p className="mt-2 max-w-sm text-sm text-slate">
          Nothing on your account was affected. You can try again, or head back home.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={reset}
            className="rounded bg-signal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-dark"
          >
            Try again
          </button>
          <Link href="/" className="rounded border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-signal">
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
