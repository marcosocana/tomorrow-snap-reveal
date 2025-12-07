/**
 * Photo filter types available for events
 */
export type FilterType = 'vintage' | '35mm' | 'none';

export const FILTER_LABELS: Record<FilterType, string> = {
  vintage: 'Vintage',
  '35mm': '35mm Film',
  none: 'Sin filtros',
};

/**
 * Get CSS class for filter type
 */
export const getFilterClass = (filterType: FilterType): string => {
  switch (filterType) {
    case 'vintage':
      return 'retro-filter';
    case '35mm':
      return 'film-35mm-filter';
    case 'none':
    default:
      return '';
  }
};

/**
 * Get grain overlay class for filter type
 */
export const getGrainClass = (filterType: FilterType): string => {
  switch (filterType) {
    case 'vintage':
      return 'film-grain';
    case '35mm':
      return 'film-grain-35mm';
    case 'none':
    default:
      return '';
  }
};

/**
 * Apply filter to canvas context for download
 */
export const applyFilterToCanvas = async (
  imageUrl: string,
  filterType: FilterType
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      if (filterType === 'vintage') {
        // Apply vintage filter: contrast(1.15) saturate(0.75) brightness(1.05) sepia(0.35) hue-rotate(-5deg)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          // Brightness (1.05)
          r *= 1.05;
          g *= 1.05;
          b *= 1.05;

          // Contrast (1.15)
          const factor = (259 * (255 * 0.15 + 255)) / (255 * (259 - 255 * 0.15));
          r = factor * (r - 128) + 128;
          g = factor * (g - 128) + 128;
          b = factor * (b - 128) + 128;

          // Desaturate (0.75)
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = gray + 0.75 * (r - gray);
          g = gray + 0.75 * (g - gray);
          b = gray + 0.75 * (b - gray);

          // Sepia (0.35)
          const sr = r * 0.393 + g * 0.769 + b * 0.189;
          const sg = r * 0.349 + g * 0.686 + b * 0.168;
          const sb = r * 0.272 + g * 0.534 + b * 0.131;
          r = r + 0.35 * (sr - r);
          g = g + 0.35 * (sg - g);
          b = b + 0.35 * (sb - b);

          data[i] = Math.min(255, Math.max(0, r));
          data[i + 1] = Math.min(255, Math.max(0, g));
          data[i + 2] = Math.min(255, Math.max(0, b));
        }

        ctx.putImageData(imageData, 0, 0);

        // Add vignette
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.5
        );
        gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        // Add light grain
        addGrain(ctx, canvas.width, canvas.height, 0.08);

      } else if (filterType === '35mm') {
        // Apply 35mm film filter
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          let r = data[i];
          let g = data[i + 1];
          let b = data[i + 2];

          // Slight warmth / color shift typical of film
          r *= 1.02;
          g *= 0.98;
          b *= 0.94;

          // Slightly reduce contrast for film look
          const factor = 0.95;
          r = factor * (r - 128) + 128;
          g = factor * (g - 128) + 128;
          b = factor * (b - 128) + 128;

          // Slight desaturation (0.85)
          const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = gray + 0.85 * (r - gray);
          g = gray + 0.85 * (g - gray);
          b = gray + 0.85 * (b - gray);

          // Lift shadows slightly (film doesn't have true blacks)
          const lift = 8;
          r = r + lift;
          g = g + lift;
          b = b + lift;

          data[i] = Math.min(255, Math.max(0, r));
          data[i + 1] = Math.min(255, Math.max(0, g));
          data[i + 2] = Math.min(255, Math.max(0, b));
        }

        ctx.putImageData(imageData, 0, 0);

        // Add subtle vignette
        const gradient = ctx.createRadialGradient(
          canvas.width / 2, canvas.height / 2, 0,
          canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) / 1.3
        );
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';

        // Add strong film grain
        addGrain(ctx, canvas.width, canvas.height, 0.15);
      }
      // For 'none', we just return the original image

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.95
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
};

/**
 * Add film grain to canvas
 */
function addGrain(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * intensity * 255;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  
  ctx.putImageData(imageData, 0, 0);
}
