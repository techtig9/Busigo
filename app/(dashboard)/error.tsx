"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

// A dashboard-scoped error boundary — catches a broken page (e.g. a data-fetch error on a
// single workflow page) without tearing down the sidebar/nav shell around it, so the user can
// still navigate elsewhere.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <p className="text-sm font-semibold text-danger">Something went wrong loading this page</p>
      <p className="mt-2 text-sm text-slate">{error.message || "An unexpected error occurred."}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset} variant="secondary">Try again</Button>
        <Button href="/dashboard">Back to dashboard</Button>
      </div>
    </div>
  );
}
