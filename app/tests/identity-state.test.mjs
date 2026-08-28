import assert from "node:assert/strict";
import test from "node:test";
import { isConfirmedIdentityUser } from "../src/auth/identityState.js";

test("treats the current Netlify Identity confirmedAt field as confirmed", () => {
  assert.equal(isConfirmedIdentityUser({ confirmedAt: "2026-08-28T05:10:00.000Z" }), true);
});

test("does not rely on the removed emailVerified field", () => {
  assert.equal(isConfirmedIdentityUser({ emailVerified: true }), false);
  assert.equal(isConfirmedIdentityUser({}), false);
  assert.equal(isConfirmedIdentityUser(null), false);
});
