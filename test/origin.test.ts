import { test } from "node:test";
import assert from "node:assert/strict";
import { originFromRequest } from "../lib/http/origin";

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers });
}

function withSiteUrl(value: string | undefined, fn: () => void) {
  const saved = process.env.NEXT_PUBLIC_SITE_URL;
  try {
    if (value === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = value;
    fn();
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = saved;
  }
}

test("NEXT_PUBLIC_SITE_URL wins, so an OAuth redirect_uri stays stable across hostnames", () => {
  withSiteUrl("https://busigo.app", () => {
    assert.equal(
      originFromRequest(req("https://busigo-git-main-x.vercel.app/api/x", { host: "busigo-git-main-x.vercel.app" })),
      "https://busigo.app"
    );
  });
});

test("a configured value keeps no trailing slash, so paths do not double up", () => {
  withSiteUrl("https://busigo.app/", () => {
    assert.equal(originFromRequest(req("https://busigo.app/api/x")), "https://busigo.app");
  });
});

// The regression: unconfigured used to yield http://localhost:3000 in production.
test("unconfigured derives the real host from forwarded headers, never localhost", () => {
  withSiteUrl(undefined, () => {
    const origin = originFromRequest(
      req("http://10.0.0.5/api/x", { "x-forwarded-host": "app.example.com", "x-forwarded-proto": "https" })
    );
    assert.equal(origin, "https://app.example.com");
    assert.ok(!origin.includes("localhost"));
  });
});

test("TLS terminated upstream still produces https, not the internal http hop", () => {
  withSiteUrl(undefined, () => {
    assert.equal(
      originFromRequest(req("http://internal.local/api/x", { "x-forwarded-host": "app.example.com" })),
      "https://app.example.com"
    );
  });
});

test("a forwarded chain uses the original client-facing host, not an intermediate hop", () => {
  withSiteUrl(undefined, () => {
    assert.equal(
      originFromRequest(
        req("http://internal/api/x", {
          "x-forwarded-host": "app.example.com, internal-lb.local",
          "x-forwarded-proto": "https, http",
        })
      ),
      "https://app.example.com"
    );
  });
});

test("plain Host header is used when nothing is forwarded", () => {
  withSiteUrl(undefined, () => {
    assert.equal(originFromRequest(req("https://app.example.com/api/x", { host: "app.example.com" })), "https://app.example.com");
  });
});

test("local development still gets http", () => {
  withSiteUrl(undefined, () => {
    assert.equal(originFromRequest(req("http://localhost:3000/api/x", { host: "localhost:3000" })), "http://localhost:3000");
  });
});
