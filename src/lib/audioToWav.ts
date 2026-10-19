/**
 * Convierte una grabación de audio (p. ej. WebM/Opus de Chrome en Android) a
 * WAV PCM mono de 16 bits. Safari en iPhone no reproduce WebM, pero WAV se
 * reproduce en cualquier navegador. La decodifica el mismo navegador que la
 * grabó, así que siempre entiende su propio formato.
 */
export const convertAudioBlobToWav = async (blob: Blob, targetSampleRate = 24_000): Promise<Blob> => {
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass || typeof OfflineAudioContext === "undefined") throw new Error("WAV_UNSUPPORTED");

  const context = new AudioContextClass();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void context.close();
  }

  // Mezcla a mono y remuestrea: para voz basta y el archivo queda pequeño.
  const frameCount = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
  const offline = new OfflineAudioContext(1, frameCount, targetSampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const dataSize = samples.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return new Blob([view], { type: "audio/wav" });
};
