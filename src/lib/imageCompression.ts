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

        // Try different quality levels to get under the size limit
        const tryCompress = (quality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Could not create blob"));
                return;
              }

              // If still too large and quality can be reduced further, try again
              if (blob.size > maxSizeInBytes && quality > 0.1) {
                tryCompress(quality - 0.1);
                return;
              }

              // Create file from blob
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });

              resolve(compressedFile);
            },
            "image/jpeg",
            quality
          );
        };

        // Start with 0.9 quality
        tryCompress(0.9);
      };
      img.onerror = () => reject(new Error("Could not load image"));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
  });
};
