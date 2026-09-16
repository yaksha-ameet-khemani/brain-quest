// Browser-only. Resizes/compresses a photo client-side into a small JPEG
// data: URL before it's ever sent to the server - so the original
// multi-megabyte phone photo never touches the network or the database,
// only a small thumbnail does. This is what keeps "store photos directly in
// Postgres" a reasonable idea on a free-tier database instead of an
// accident waiting to blow through its storage limit.

const MAX_DIMENSION = 256;
const MAX_DATA_URL_LENGTH = 300_000; // ~300KB of base64 text, generous for a 256px thumbnail

export class ImageTooLargeError extends Error {
  constructor() {
    super("That photo is too large even after compressing it. Try a different one.");
  }
}

export function fileToResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like a valid image."));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Your browser can't process images here."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        // Step quality down if needed rather than failing outright - a
        // 256px thumbnail should virtually never need this, but a very
        // busy/noisy photo could compress worse than expected.
        let quality = 0.85;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);
        while (dataUrl.length > MAX_DATA_URL_LENGTH && quality > 0.3) {
          quality -= 0.15;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          reject(new ImageTooLargeError());
          return;
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
