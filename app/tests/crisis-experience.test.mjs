import assert from "node:assert/strict";
import test from "node:test";
import { canCompleteCrisisHandoff, getCrisisCompletion } from "../src/utils/crisisExperience.js";

test("crisis handoff requires human review, a direct safety check, and school support", () => {
  assert.equal(canCompleteCrisisHandoff({ humanReviewed: true, safetyChecked: true }), false);
  assert.equal(canCompleteCrisisHandoff({ humanReviewed: true, safetyChecked: true, schoolSupportContacted: true }), true);
});

test("crisis progress counts optional connection steps without requiring them", () => {
  assert.deepEqual(getCrisisCompletion({ humanReviewed: true, trustedPersonContacted: true }), { completed: 2, total: 5 });
});
