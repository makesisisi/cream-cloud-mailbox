import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { prepareAiImage, MAX_AI_IMAGE_BYTES } from "../netlify/functions/_lib/ai-image.mjs";

test("large noisy image becomes a bounded JPEG without changing original", async () => {
  const original = await sharp(randomBytes(1600 * 1000 * 3), { raw: { width: 1600, height: 1000, channels: 3 } }).png().toBuffer();
  const before = Buffer.from(original);
  const preview = await prepareAiImage(original);
  const bytes = Buffer.from(preview.dataUrl.split(",")[1], "base64");
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.ok(bytes.length <= MAX_AI_IMAGE_BYTES);
  assert.ok(metadata.width <= 768 && metadata.height <= 768);
  assert.ok(Math.abs(metadata.width / metadata.height - 1.6) < 0.02);
  assert.deepEqual(original, before);
});

test("invalid image is rejected", async () => {
  await assert.rejects(prepareAiImage(Buffer.from("not an image")));
});
