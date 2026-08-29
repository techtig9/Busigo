import { test } from "node:test";
import assert from "node:assert/strict";
import { roleAtLeast, WORKSPACE_ROLES } from "../lib/workspace/roles";

test("roleAtLeast: owner meets every minimum role, including itself", () => {
  for (const min of WORKSPACE_ROLES) {
    assert.equal(roleAtLeast("owner", min), true, `owner should meet minimum "${min}"`);
  }
});

test("roleAtLeast: viewer only meets the viewer minimum", () => {
  assert.equal(roleAtLeast("viewer", "viewer"), true);
  assert.equal(roleAtLeast("viewer", "member"), false);
  assert.equal(roleAtLeast("viewer", "admin"), false);
  assert.equal(roleAtLeast("viewer", "owner"), false);
});

test("roleAtLeast: billing_admin and security_admin sit at the same rank, above member and below manager", () => {
  assert.equal(roleAtLeast("billing_admin", "member"), true);
  assert.equal(roleAtLeast("security_admin", "member"), true);
  assert.equal(roleAtLeast("billing_admin", "security_admin"), true);
  assert.equal(roleAtLeast("security_admin", "billing_admin"), true);
  assert.equal(roleAtLeast("billing_admin", "manager"), false);
});

test("roleAtLeast: admin outranks manager outranks member outranks viewer", () => {
  assert.equal(roleAtLeast("admin", "manager"), true);
  assert.equal(roleAtLeast("manager", "member"), true);
  assert.equal(roleAtLeast("member", "viewer"), true);
  assert.equal(roleAtLeast("manager", "admin"), false);
  assert.equal(roleAtLeast("member", "manager"), false);
  assert.equal(roleAtLeast("viewer", "member"), false);
});

test("roleAtLeast: nobody outranks owner", () => {
  for (const role of WORKSPACE_ROLES) {
    if (role === "owner") continue;
    assert.equal(roleAtLeast(role, "owner"), false, `${role} should not meet the owner minimum`);
  }
});
