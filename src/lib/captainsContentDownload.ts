const DOWNLOAD_CONCURRENCY = 3;
const RETRY_DELAYS = [700, 1800, 4000];
const FILE_TIMEOUT_MS = 120_000;

class DownloadHttpError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

const isRetryable = (error: unknown) => !(error instanceof DownloadHttpError)
  || error.status === 408 || error.status === 429 || error.status >= 500;

/** Limit signing, response streams and blob reads together, not just fetch(). */
export async function downloadCaptainsContentFiles<T>(files: T[], options: {
  getUrl: (file: T) => Promise<string>;
  onFile: (file: T, blob: Blob, index: number) => void;
  onProgress: (completed: number, total: number) => void;
}) {
  let cursor = 0;
  let completed = 0;
  let failure: Error | null = null;
  const controllers = new Set<AbortController>();
  options.onProgress(0, files.length);

  const worker = async () => {
    while (!failure && cursor < files.length) {
      const index = cursor++;
      const file = files[index];
      for (let attempt = 0; attempt <= RETRY_DELAYS.length && !failure; attempt++) {
        const controller = new AbortController();
        controllers.add(controller);
        const timeout = setTimeout(() => controller.abort(), FILE_TIMEOUT_MS);
        let error: unknown;
        try {
          // Sign immediately before downloading; long queues must not reuse
          // a URL that was obtained at the start of the whole export.
          const url = await options.getUrl(file);
          if (failure) return;
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) {
            await response.body?.cancel();
            throw new DownloadHttpError(response.status);
          }
          const blob = await response.blob();
          if (failure) return;
          options.onFile(file, blob, index);
          options.onProgress(++completed, files.length);
          break;
        } catch (cause) {
          if (failure) return;
          error = cause;
          if (!isRetryable(cause) || attempt === RETRY_DELAYS.length) {
            failure = new Error(`No se ha podido descargar el archivo ${index + 1} de ${files.length}. Vuelve a pulsar Descargar todo para intentarlo de nuevo.`);
            controllers.forEach(active => active.abort());
            return;
          }
        } finally {
          clearTimeout(timeout);
          controllers.delete(controller);
        }
        if (error) await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }
  };

  // Wait until every worker has stopped before the UI allows a new export.
  await Promise.all(Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, files.length) }, worker));
  if (failure) throw failure;
}
