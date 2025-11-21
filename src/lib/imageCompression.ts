/**
 * Compress an image file to be under maxSizeInMB
 * @param file - The image file to compress
 * @param maxSizeInMB - Maximum file size in MB (default 1MB)
 * @returns Compressed image file
 */
export const compressImage = async (
  file: File,
  maxSizeInMB: number = 1
): Promise<File> => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;

  // If file is already under the limit, return as is
  if (file.size <= maxSizeInBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions if image is too large
        const MAX_DIMENSION = 2048;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_DIMENSION;
            width = MAX_DIMENSION;
          } else {
            width = (width / height) * MAX_DIMENSION;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Binary search to find optimal quality for target size
        let minQuality = 0.1;
        let maxQuality = 0.95;
        let bestBlob: Blob | null = null;
        let attempts = 0;
        const maxAttempts = 8;

        const tryCompress = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Could not create blob"));
                return;
              }

              attempts++;

              // If this is closer to target without exceeding, save it
              if (blob.size <= maxSizeInBytes) {
                if (!bestBlob || blob.size > bestBlob.size) {
                  bestBlob = blob;
                }
              }

              // Binary search to get as close to 1MB as possible
              if (attempts < maxAttempts) {
                if (blob.size > maxSizeInBytes) {
                  // Too large, reduce quality
                  maxQuality = quality;
                  tryCompress((minQuality + quality) / 2);
                } else if (blob.size < maxSizeInBytes * 0.85) {
                  // Too small (less than 85% of target), increase quality
                  minQuality = quality;
                  tryCompress((quality + maxQuality) / 2);
                } else {
                  // Close enough to target (85-100% of 1MB)
                  const compressedFile = new File([blob], file.name, {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                }
              } else {
                // Max attempts reached, use best result
                const finalBlob = bestBlob || blob;
                const compressedFile = new File([finalBlob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            "image/jpeg",
            quality
          );
        };

        // Start with 0.85 quality
        tryCompress(0.85);
      };
      img.onerror = () => reject(new Error("Could not load image"));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
  });
};
