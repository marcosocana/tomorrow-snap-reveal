import type { PhotostripMode } from "@/lib/photostrip";

type GenerateOptions = {
  mode: PhotostripMode;
  eventName: string;
  eventDate: string | null;
  footerText: string | null;
  logoUrl: string | null;
  thumbnail?: boolean;
};

const loadBitmap = (blob: Blob) => createImageBitmap(blob);
const loadRemoteBitmap = async (url: string) => {
  const response = await fetch(url, { mode: "cors" });
  if (!response.ok) throw new Error("LOGO_LOAD_FAILED");
  return createImageBitmap(await response.blob());
};
const canvasBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("STRIP_GENERATION_FAILED")), "image/webp", quality);
});

const drawCover = (
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
};

export const generatePhotostrip = async (photos: Blob[], options: GenerateOptions) => {
  if (photos.length !== 4) throw new Error("FOUR_PHOTOS_REQUIRED");
  const width = options.thumbnail ? 360 : 1200;
  const border = Math.round(width * 0.045);
  const gap = Math.round(width * 0.022);
  const photoWidth = width - border * 2;
  const photoHeight = Math.round(photoWidth * 0.72);
  const footerHeight = Math.round(width * 0.32);
  const height = border + (photoHeight * 4) + (gap * 3) + footerHeight + border;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.fillStyle = "#f7f0df";
  context.fillRect(0, 0, width, height);
  const bitmaps = await Promise.all(photos.map(loadBitmap));
  try {
    bitmaps.forEach((bitmap, index) => {
      const y = border + index * (photoHeight + gap);
      context.save();
      context.filter = options.mode === "bw" ? "grayscale(1) contrast(1.08)" : "saturate(.94) contrast(1.025) sepia(.035)";
      drawCover(context, bitmap, border, y, photoWidth, photoHeight);
      context.restore();
      context.fillStyle = "rgba(32, 25, 20, 0.035)";
      for (let grain = 0; grain < width / 3; grain += 1) {
        const gx = border + Math.random() * photoWidth;
        const gy = y + Math.random() * photoHeight;
        context.fillRect(gx, gy, 1, 1);
      }
    });
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }

  const footerY = border + 4 * photoHeight + 3 * gap;
  if (options.logoUrl) {
    try {
      const logo = await loadRemoteBitmap(options.logoUrl);
      const maxWidth = width * 0.16;
      const maxHeight = width * 0.055;
      const scale = Math.min(maxWidth / logo.width, maxHeight / logo.height, 1);
      const logoWidth = logo.width * scale;
      const logoHeight = logo.height * scale;
      context.drawImage(logo, (width - logoWidth) / 2, footerY + width * 0.025, logoWidth, logoHeight);
      logo.close();
    } catch {
      // External branding must never prevent the guest from generating a strip.
    }
  }
  context.textAlign = "center";
  context.fillStyle = "#241c18";
  context.font = `700 ${Math.round(width * 0.055)}px Georgia, serif`;
  context.fillText(options.eventName.slice(0, 42), width / 2, footerY + width * 0.115);
  context.font = `600 ${Math.round(width * 0.025)}px Arial, sans-serif`;
  context.letterSpacing = `${Math.round(width * 0.004)}px`;
  const date = options.eventDate ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(options.eventDate)) : "";
  context.fillText((options.footerText || date).slice(0, 70).toUpperCase(), width / 2, footerY + width * 0.175);
  context.font = `700 ${Math.round(width * 0.024)}px Arial, sans-serif`;
  context.fillStyle = "#e6675c";
  context.fillText("PHOTOSTRIP · REVELAO", width / 2, footerY + width * 0.245);
  return canvasBlob(canvas, options.thumbnail ? 0.76 : 0.88);
};

export const captureVideoFrame = async (video: HTMLVideoElement, mode: PhotostripMode) => {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("CAMERA_NOT_READY");
  const outputWidth = 1400;
  const outputHeight = 1050;
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  const scale = Math.max(outputWidth / sourceWidth, outputHeight / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.save();
  context.translate(outputWidth, 0);
  context.scale(-1, 1);
  if (mode === "bw") context.filter = "grayscale(1) contrast(1.08)";
  context.drawImage(video, (outputWidth - drawWidth) / 2, (outputHeight - drawHeight) / 2, drawWidth, drawHeight);
  context.restore();
  return canvasBlob(canvas, 0.86);
};
