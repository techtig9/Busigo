"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

// A dashboard-scoped error boundary — catches a broken page (e.g. a data-fetch error on a
// single workflow page) without tearing down the sidebar/nav shell around it, so the user can
// still navigate elsewhere.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-12">
      <ErrorState
        body="This page couldn't load. The rest of the app is still working, so you can navigate elsewhere and come back."
        detail={error.message}
        // Next.js sets `digest` on server errors — it is the id that ties this failure to the
        // server log entry, which is exactly what support needs to look it up.
        requestId={error.digest}
        onRetry={reset}
      />
    </div>
  );
}
