import { test } from "node:test";
import assert from "node:assert/strict";
import { listIntegrationProviders } from "../lib/integrations/registry";

test("phase 8 integration registry exposes the supported providers", () => {
  const providers = listIntegrationProviders();
  assert.equal(providers.length, 7);
  assert.ok(providers.every((x) => x.requires_oauth));
});
