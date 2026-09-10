import { getStore } from "@netlify/blobs";
import { HttpError } from "./chat-domain.mjs";

export const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IMAGE_STORE_NAME = "private-conversation-images";

let imageStore;

function getImageStore() {
  if (!imageStore) imageStore = getStore({ name: IMAGE_STORE_NAME, consistency: "strong" });
  return imageStore;
}

export function detectImageType(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes ?? []);
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return "image/jpeg";
  if (
    view.length >= 8
    && view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47
    && view[4] === 0x0d && view[5] === 0x0a && view[6] === 0x1a && view[7] === 0x0a
  ) return "image/png";
  if (
    view.length >= 12
    && String.fromCharCode(...view.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...view.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  return null;
}

export async function validateImageUpload(file) {
  if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "请选择一张有效的图片。");
  if (file.size > MAX_IMAGE_SIZE) throw new HttpError(400, "图片不能超过 4 MB。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = detectImageType(bytes);
  if (!contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new HttpError(400, "只支持 JPG、PNG 或 WebP 图片。");
  }
  return { bytes, contentType, size: bytes.byteLength };
}

export async function storePrivateImage({ conversationId, messageId, attachmentId, bytes, contentType }) {
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const storageKey = `conversations/${conversationId}/${messageId}/${attachmentId}.${extension}`;
  await getImageStore().set(storageKey, bytes, {
    metadata: {
      contentType,
      size: bytes.byteLength,
      conversationId,
      messageId,
      createdAt: new Date().toISOString(),
    },
  });
  return storageKey;
}

export async function deletePrivateImage(storageKey) {
  if (storageKey) await getImageStore().delete(storageKey);
}

export async function readPrivateImage(storageKey, type = "arrayBuffer") {
  return getImageStore().get(storageKey, { type });
}

export function toPublicAttachment(row) {
  return {
    id: row.id,
    kind: "image",
    contentType: row.content_type,
    size: Number(row.size_bytes),
    url: `/api/conversations/${row.conversation_id}/attachments/${row.id}`,
  };
}
