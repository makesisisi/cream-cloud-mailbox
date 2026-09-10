export const MAX_AI_IMAGE_BYTES = 48 * 1024;

export async function prepareAiImage(data) {
  const { default: sharp } = await import("sharp");
  const input = Buffer.from(data);
  for (const [size, quality] of [[768, 65], [512, 55], [384, 40], [256, 35]]) {
    const output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(size, size, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (output.length <= MAX_AI_IMAGE_BYTES) {
      return { contentType: "image/jpeg", dataUrl: `data:image/jpeg;base64,${output.toString("base64")}` };
    }
  }
  throw new Error("ai_image_too_large");
}
