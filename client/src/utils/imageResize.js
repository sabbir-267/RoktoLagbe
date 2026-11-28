// Turns a chosen photo into a small square profile picture in the browser:
// centre-cropped, AVATAR_SIZE px, re-encoded (which also drops camera data such as GPS location).
export const AVATAR_SIZE = 320;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

const loadImage = async (file) => {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img> below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

// Throws an Error whose message is a key: "notImage" | "tooBig" | "cantRead"
export async function squareAvatar(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("notImage");
  if (file.size > MAX_INPUT_BYTES) throw new Error("tooBig");

  let img;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error("cantRead"); // e.g. HEIC photos in browsers that can't open them
  }
  const w = img.width;
  const h = img.height;
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  img.close?.();

  // WebP is smallest; browsers that can't encode it return PNG instead, so fall back to JPEG
  let blob = await toBlob(canvas, "image/webp", 0.85);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.85);
  if (!blob) throw new Error("cantRead");
  return blob;
}
