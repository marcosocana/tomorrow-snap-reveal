import { supabase } from "@/integrations/supabase/client";

export type CarreteoAvailability = "upcoming" | "active" | "closed" | "revealed" | "inactive";

export type PublicCarreteoEvent = {
  name: string;
  slug: string;
  startsAt: string | null;
  endsAt: string | null;
  revealAt: string | null;
  timezone: string;
  availability: CarreteoAvailability;
  shotsPerCamera: number;
  coverImageUrl: string | null;
  eventNumber: number | null;
};

export type CarreteoGalleryPhoto = {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  takenAt: string;
};

type ApiErrorPayload = { error?: string };

const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/carreteo-api`;
const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export class CarreteoApiError extends Error {
  constructor(message: string, readonly payload: Record<string, unknown>) {
    super(message);
  }
}

export const carreteoApi = async <T>(body: Record<string, unknown> | FormData, authenticated = false): Promise<T> => {
  const headers: Record<string, string> = { apikey: apiKey };
  if (!(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("UNAUTHORIZED");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ error: "INVALID_RESPONSE" })) as T & ApiErrorPayload;
  if (!response.ok) throw new CarreteoApiError(payload.error || `HTTP_${response.status}`, payload as Record<string, unknown>);
  return payload;
};

const bytesToHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const getCarreteoIdentity = (slug: string) => {
  const key = `revelao-carreteo-camera:${slug}`;
  try {
    const existing = JSON.parse(localStorage.getItem(key) || "null") as { id?: string; token?: string } | null;
    if (existing?.id && existing.token) return { id: existing.id, token: existing.token };
  } catch {
    // Replace malformed local state with a fresh anonymous identity.
  }
  const identity = {
    id: crypto.randomUUID(),
    token: bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
  };
  try {
    localStorage.setItem(key, JSON.stringify(identity));
  } catch {
    // Without storage the camera still works for this visit.
  }
  return identity;
};

export const downloadCarreteoPhoto = async (url: string, name: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("DOWNLOAD_FAILED");
  const objectUrl = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
};

export const shareCarreteoPhoto = async (url: string, name: string) => {
  if (navigator.share) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("SHARE_DOWNLOAD_FAILED");
      const file = new File([await response.blob()], name, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: "Carreteo by Revelao", files: [file] });
      } else {
        await navigator.share({ title: "Carreteo by Revelao", url });
      }
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    }
  }
  await downloadCarreteoPhoto(url, name);
};

// Sonidos sintetizados con Web Audio: sin ficheros que descargar y con
// latencia mínima, lo que importa para que el clic coincida con el gesto.
let audioContext: AudioContext | null = null;

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext) audioContext = new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
};

const noiseBuffer = (context: AudioContext, seconds: number) => {
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
};

const click = (
  context: AudioContext,
  at: number,
  { frequency, q, gain, decay, type = "bandpass" }: { frequency: number; q: number; gain: number; decay: number; type?: BiquadFilterType },
) => {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, decay + 0.02);
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.002);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  source.connect(filter).connect(envelope).connect(context.destination);
  source.start(at);
  source.stop(at + decay + 0.02);
};

const thump = (context: AudioContext, at: number, frequency: number, gain: number, decay: number) => {
  const oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, at);
  oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.45, at + decay);
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(gain, at + 0.003);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  oscillator.connect(envelope).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + decay + 0.02);
};

export const unlockCarreteoAudio = () => {
  getAudioContext();
};

/** Diente del trinquete al girar la rueda de arrastre. */
export const playWindTick = () => {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const detune = 0.85 + Math.random() * 0.3;
  click(context, now, { frequency: 3200 * detune, q: 6, gain: 0.35, decay: 0.018 });
  click(context, now + 0.004, { frequency: 1400 * detune, q: 3, gain: 0.12, decay: 0.025 });
};

/** Tope de la rueda: el carrete queda listo para disparar. */
export const playWindLock = () => {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  click(context, now, { frequency: 2600, q: 4, gain: 0.55, decay: 0.03 });
  click(context, now + 0.035, { frequency: 1800, q: 5, gain: 0.4, decay: 0.035 });
  thump(context, now + 0.035, 220, 0.25, 0.06);
};

/** Obturador de cámara desechable: apertura seca y cierre de la cortinilla. */
export const playShutter = () => {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  click(context, now, { frequency: 4200, q: 1.2, gain: 0.8, decay: 0.035, type: "highpass" });
  thump(context, now, 170, 0.5, 0.08);
  click(context, now + 0.06, { frequency: 2400, q: 2.5, gain: 0.55, decay: 0.045 });
  thump(context, now + 0.06, 120, 0.3, 0.07);
};
