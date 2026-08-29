import Link from "next/link";
import { APP_NAME } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-panel">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-slate sm:flex-row sm:items-center sm:justify-between">
        <div>
          © {new Date().getFullYear()} {APP_NAME}. Built by{" "}
          <Link href="/about" className="text-signal hover:underline">
            Techtig
          </Link>
          .
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
          <Link href="/help" className="hover:text-ink">
            Help
          </Link>
          <Link href="/about" className="hover:text-ink">
            About Us
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <a href="mailto:techtig9@gmail.com" className="hover:text-ink">
            techtig9@gmail.com
          </a>
          <a href="tel:+92 3488597892" className="hover:text-ink">
            +92 348 8597892
          </a>
        </div>
      </div>
    </footer>
  );
}
