import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveString, resolveConfig, extractReferences } from "../lib/engine/merge-fields";

test("resolveString: substitutes a simple trigger field", () => {
  assert.equal(resolveString("Hello {{trigger.name}}", { trigger: { name: "Ada" } }), "Hello Ada");
});

test("resolveString: substitutes a nested dotted path", () => {
  const data = { trigger: { customer: { email: "a@b.com" } } };
  assert.equal(resolveString("{{trigger.customer.email}}", data), "a@b.com");
});

test("resolveString: substitutes a prior step's output", () => {
  assert.equal(resolveString("Result: {{step1.output}}", { step1: { output: "done" } }), "Result: done");
});

test("resolveString: multiple references in one template", () => {
  const data = { trigger: { a: "1" }, step1: { b: "2" } };
  assert.equal(resolveString("{{trigger.a}}-{{step1.b}}", data), "1-2");
});

test("resolveString: missing reference resolves to empty string, not 'undefined'", () => {
  assert.equal(resolveString("X{{trigger.missing}}Y", { trigger: {} }), "XY");
});

test("resolveString: non-string values are JSON-stringified", () => {
  assert.equal(resolveString("{{trigger.obj}}", { trigger: { obj: { a: 1 } } }), '{"a":1}');
  assert.equal(resolveString("{{trigger.n}}", { trigger: { n: 42 } }), "42");
});

test("resolveString: text with no merge fields passes through unchanged", () => {
  assert.equal(resolveString("plain text, no braces", {}), "plain text, no braces");
});

test("resolveConfig: resolves merge fields inside nested config objects and arrays", () => {
  const config = {
    url: "https://example.com/{{trigger.id}}",
    nested: { greeting: "hi {{trigger.name}}" },
    list: ["{{trigger.name}}", "static"],
    untouched: 42,
  };
  const data = { trigger: { id: "abc", name: "Ada" } };
  assert.deepEqual(resolveConfig(config, data), {
    url: "https://example.com/abc",
    nested: { greeting: "hi Ada" },
    list: ["Ada", "static"],
    untouched: 42,
  });
});

test("extractReferences: finds every unique {{...}} reference in a template", () => {
  const refs = extractReferences("{{trigger.a}} and {{step1.b}} and {{trigger.a}} again");
  assert.deepEqual([...refs].sort(), ["step1.b", "trigger.a"]);
});

test("extractReferences: returns empty array for a template with no references", () => {
  assert.deepEqual(extractReferences("no merge fields here"), []);
});
