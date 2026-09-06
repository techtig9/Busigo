"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function AnalyzeBusinessButton() {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  async function run() {
    setState("loading"); setMessage("");
    try {
      const res = await fetch("/api/business-os/analyze", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setMessage(`Found ${data.created} new opportunities. ${data.summary}`); setState("done");
    } catch (e: any) { setMessage(e.message || "Analysis failed"); setState("error"); }
  }
  return <div><Button type="button" onClick={run} disabled={state === "loading"}>{state === "loading" ? "Analyzing…" : "Analyze my business"}</Button>{message && <p className={`mt-2 text-xs ${state === "error" ? "text-danger-ink" : "text-slate"}`}>{message}</p>}</div>;
}
