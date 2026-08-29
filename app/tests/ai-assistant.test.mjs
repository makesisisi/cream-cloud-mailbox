import assert from "node:assert/strict";
import test from "node:test";
import { detectUrgentSafety, normalizeAiResult } from "../netlify/functions/_lib/ai-assistant.mjs";

test("normalizes model output to the supported emotion analysis shape", () => {
  const result = normalizeAiResult({
    primaryEmotion: " 焦虑 ",
    secondaryEmotions: ["担心", "疲惫", "委屈", "extra"],
    intensity: 9,
    currentNeed: "先被理解",
    followUpQuestions: ["最近什么最难？", "身边有人吗？", "extra"],
    safetyLevel: "unknown",
    confidence: 2,
  });

  assert.equal(result.primaryEmotion, "焦虑");
  assert.deepEqual(result.secondaryEmotions, ["担心", "疲惫", "委屈"]);
  assert.equal(result.intensity, 3);
  assert.equal(result.safetyLevel, "normal");
  assert.equal(result.confidence, 1);
  assert.equal(result.followUpQuestions.length, 2);
});

test("deterministic safety detection raises urgent text for human review", () => {
  assert.equal(detectUrgentSafety("我今晚想吞药结束生命"), true);
  const result = normalizeAiResult({ safetyLevel: "normal" }, "我不想活了");
  assert.equal(result.safetyLevel, "urgent");
  assert.equal(result.safetyReasons.length, 1);
});

test("ordinary distress is not automatically marked urgent", () => {
  assert.equal(detectUrgentSafety("最近考试压力很大，也总是睡不好"), false);
});
