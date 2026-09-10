import assert from "node:assert/strict";
import test from "node:test";
import {
  detectImageType,
  toPublicAttachment,
  validateImageUpload,
} from "../netlify/functions/_lib/chat-attachments.mjs";

test("detects supported image formats from file signatures", () => {
  assert.equal(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectImageType(new TextEncoder().encode("RIFF0000WEBP")), "image/webp");
  assert.equal(detectImageType(new TextEncoder().encode("<svg></svg>")), null);
});

test("rejects disguised or empty image uploads", async () => {
  await assert.rejects(() => validateImageUpload(new Blob([])), /有效的图片/);
  await assert.rejects(
    () => validateImageUpload(new Blob(["<svg></svg>"], { type: "image/png" })),
    /只支持 JPG、PNG 或 WebP/,
  );
});

test("public attachment metadata never exposes the private blob key", () => {
  const attachment = toPublicAttachment({
    id: "attachment-a",
    conversation_id: "conversation-a",
    content_type: "image/png",
    size_bytes: 128,
    storage_key: "private/secret-key.png",
  });
  assert.equal(attachment.url, "/api/conversations/conversation-a/attachments/attachment-a");
  assert.equal(JSON.stringify(attachment).includes("secret-key"), false);
});
