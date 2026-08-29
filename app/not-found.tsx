import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center animate-fade-in">
      <p className="text-sm font-semibold text-signal">404</p>
      <h1 className="mt-2 text-3xl font-bold text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate">
        The page you're looking for doesn't exist, or you may need to log in to see it.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="rounded border border-hairline px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-signal">
          Go home
        </Link>
        <Link href="/dashboard" className="rounded bg-signal px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-signal-dark">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
