import { supabase } from "@/integrations/supabase/client";

/**
 * Miniaturas de las fotos de los eventos. Se generan en el móvil al subir la
 * foto y se guardan junto a ella (`<foto>_thumb.jpg`), con su ruta en
 * `photos.metadata.thumbnail_path`. Así la galería las firma todas en una sola
 * petición en lugar de pedir a Supabase una transformación por foto.
 *
 * Las fotos antiguas no tienen miniatura propia y siguen usando la
 * transformación de Supabase como hasta ahora.
 */

const THUMBNAIL_MAX_SIDE = 720;
const THUMBNAIL_QUALITY = 0.75;

export type PhotoMetadata = { thumbnail_path?: string } | null;

/** Ruta fija de la miniatura de una foto; borrar una ruta inexistente es inocuo. */
export const thumbnailPathFor = (imagePath: string) => imagePath.replace(/\.[a-z0-9]+$/i, "") + "_thumb.jpg";

export const thumbnailPathFromMetadata = (metadata: unknown) => {
  const path = (metadata as PhotoMetadata)?.thumbnail_path;
  return typeof path === "string" && path ? path : null;
};

/** Rutas de almacenamiento de unas fotos junto con sus posibles miniaturas. */
export const photoStoragePaths = (imagePaths: Array<string | null | undefined>) =>
  imagePaths.flatMap((path) => (path ? [path, thumbnailPathFor(path)] : []));

const loadImage = async (source: Blob) => {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(source, { imageOrientation: "from-image" });
    } catch {
      // Algunos navegadores no aceptan las opciones; se usa <img> como respaldo.
    }
  }
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const createThumbnail = async (source: Blob) => {
  const image = await loadImage(source);
  const width = "naturalWidth" in image ? image.naturalWidth : image.width;
  const height = "naturalHeight" in image ? image.naturalHeight : image.height;
  if (!width || !height) throw new Error("THUMBNAIL_EMPTY_IMAGE");
  const scale = Math.min(1, THUMBNAIL_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("THUMBNAIL_CANVAS_UNAVAILABLE");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  if ("close" in image) image.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("THUMBNAIL_ENCODE_FAILED"))), "image/jpeg", THUMBNAIL_QUALITY);
  });
};

/**
 * Genera y sube la miniatura de una foto ya comprimida. Nunca rompe la subida
 * de la foto: si algo falla devuelve null y la galería usará la transformación.
 */
export const uploadPhotoThumbnail = async (imagePath: string, source: Blob) => {
  try {
    const thumbnail = await createThumbnail(source);
    const thumbnailPath = thumbnailPathFor(imagePath);
    const { error } = await supabase.storage.from("event-photos").upload(thumbnailPath, thumbnail, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    });
    if (error) throw error;
    return thumbnailPath;
  } catch (error) {
    console.warn("No se pudo crear la miniatura de la foto:", error);
    return null;
  }
};

/** Valor de `photos.metadata` para una foto con (o sin) miniatura propia. */
export const photoMetadataFor = (thumbnailPath: string | null) => (thumbnailPath ? { thumbnail_path: thumbnailPath } : null);
