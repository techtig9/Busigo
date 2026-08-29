"use client";

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

export function ExportButtons({ workflowName, data }: { workflowName: string; data: Record<string, any>[] }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => download(`${workflowName}-runs.json`, JSON.stringify(data, null, 2), "application/json")}
        className="rounded border border-hairline px-3 py-1.5 text-xs font-semibold text-ink hover:border-signal"
      >
        Export JSON
      </button>
      <button
        type="button"
        onClick={() => download(`${workflowName}-runs.csv`, toCsv(data), "text/csv")}
        className="rounded border border-hairline px-3 py-1.5 text-xs font-semibold text-ink hover:border-signal"
      >
        Export CSV
      </button>
    </div>
  );
}
