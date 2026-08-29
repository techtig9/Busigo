import { Card } from "@/components/ui/Card";

// Next.js shows this automatically while a dashboard route's Server Component is fetching
// data — no wiring needed beyond this file existing. Uses the .skeleton shimmer defined in
// globals.css.
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-9 w-32" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-2 h-7 w-16" />
          </Card>
        ))}
      </div>
      <Card>
        <div className="skeleton h-5 w-32" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
