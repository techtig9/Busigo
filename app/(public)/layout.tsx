import Link from "next/link";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { APP_NAME } from "@/lib/utils";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-hairline bg-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-bold text-ink">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="hidden text-slate transition-colors hover:text-ink sm:inline">Pricing</Link>
            <Link href="/about" className="hidden text-slate transition-colors hover:text-ink sm:inline">About</Link>
            <Link href="/help" className="hidden text-slate transition-colors hover:text-ink sm:inline">Help</Link>
            <ThemeToggle />
            <Link href="/login" className="text-slate transition-colors hover:text-ink">Log in</Link>
            <Link href="/signup" className="rounded bg-signal px-3 py-1.5 text-white transition-all hover:bg-signal-dark hover:shadow-md active:scale-95">
              Sign up free
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
