import { supabase } from "@/integrations/supabase/client";
import { supabasePublic } from "@/integrations/supabase/publicClient";

type StorageBucketApi = ReturnType<typeof supabase.storage.from>;
type SignedUrlOptions = Parameters<StorageBucketApi["createSignedUrl"]>[2];
type ClientScope = "authenticated" | "public";

type SignedUrlRequest = {
  bucket: string;
  path: string;
  expiresInSeconds: number;
  options?: SignedUrlOptions;
  clientScope?: ClientScope;
};

type SignedUrlsRequest = Omit<SignedUrlRequest, "path" | "options"> & {
  paths: string[];
};

type CacheEntry = {
  signedUrl: string;
  expiresAt: number;
};

type Deferred = {
  promise: Promise<string>;
  resolve: (signedUrl: string) => void;
};

const signedUrlCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<string>>();
const cacheGenerations: Record<ClientScope, number> = { authenticated: 0, public: 0 };
const MAX_CACHE_ENTRIES = 2_000;

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`)
    .join(",")}}`;
};

const getCacheKey = ({
  bucket,
  path,
  expiresInSeconds,
  options,
  clientScope = "authenticated",
}: SignedUrlRequest) => stableSerialize({ clientScope, bucket, path, expiresInSeconds, options: options ?? null });

const getRenewalWindowMs = (expiresInSeconds: number) =>
  Math.min(60_000, Math.max(5_000, expiresInSeconds * 1_000 * 0.05));

const readValidCacheEntry = (key: string, expiresInSeconds: number) => {
  const entry = signedUrlCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt - getRenewalWindowMs(expiresInSeconds)) {
    signedUrlCache.delete(key);
    return null;
  }
  // Refresh insertion order so the size cap behaves as a small LRU cache.
  signedUrlCache.delete(key);
  signedUrlCache.set(key, entry);
  return entry.signedUrl;
};

const storeCacheEntry = (key: string, signedUrl: string, expiresInSeconds: number) => {
  signedUrlCache.set(key, {
    signedUrl,
    expiresAt: Date.now() + expiresInSeconds * 1_000,
  });
  while (signedUrlCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = signedUrlCache.keys().next().value;
    if (!oldestKey) break;
    signedUrlCache.delete(oldestKey);
  }
};

const getClient = (scope: ClientScope) => scope === "public" ? supabasePublic : supabase;

const createDeferred = (): Deferred => {
  let resolve!: (signedUrl: string) => void;
  const promise = new Promise<string>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

export const getSignedUrlCached = async (request: SignedUrlRequest): Promise<string> => {
  if (!request.path) return "";
  const key = getCacheKey(request);
  const cachedUrl = readValidCacheEntry(key, request.expiresInSeconds);
  if (cachedUrl) return cachedUrl;

  const existingRequest = inFlightRequests.get(key);
  if (existingRequest) return existingRequest;

  const clientScope = request.clientScope ?? "authenticated";
  const generation = cacheGenerations[clientScope];
  const signedUrlRequest = (async () => {
    const { data, error } = await getClient(clientScope).storage
      .from(request.bucket)
      .createSignedUrl(request.path, request.expiresInSeconds, request.options);
    if (error) return "";
    const signedUrl = data?.signedUrl || "";
    if (signedUrl && generation === cacheGenerations[clientScope]) {
      storeCacheEntry(key, signedUrl, request.expiresInSeconds);
    }
    return signedUrl;
  })();

  inFlightRequests.set(key, signedUrlRequest);
  try {
    return await signedUrlRequest;
  } finally {
    if (inFlightRequests.get(key) === signedUrlRequest) {
      inFlightRequests.delete(key);
    }
  }
};

export const getSignedUrlsCached = async ({
  bucket,
  paths,
  expiresInSeconds,
  clientScope = "authenticated",
}: SignedUrlsRequest): Promise<Map<string, string>> => {
  const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
  const results = new Map<string, string>();
  const requestsToAwait: Promise<void>[] = [];
  const missing: Array<{ path: string; key: string; deferred: Deferred }> = [];

  for (const path of uniquePaths) {
    const request = { bucket, path, expiresInSeconds, clientScope };
    const key = getCacheKey(request);
    const cachedUrl = readValidCacheEntry(key, expiresInSeconds);
    if (cachedUrl) {
      results.set(path, cachedUrl);
      continue;
    }

    const existingRequest = inFlightRequests.get(key);
    if (existingRequest) {
      requestsToAwait.push(existingRequest.then((signedUrl) => {
        results.set(path, signedUrl);
      }));
      continue;
    }

    const deferred = createDeferred();
    inFlightRequests.set(key, deferred.promise);
    missing.push({ path, key, deferred });
    requestsToAwait.push(deferred.promise.then((signedUrl) => {
      results.set(path, signedUrl);
    }));
  }

  if (missing.length > 0) {
    const generation = cacheGenerations[clientScope];
    void (async () => {
      try {
        const { data, error } = await getClient(clientScope).storage
          .from(bucket)
          .createSignedUrls(missing.map(({ path }) => path), expiresInSeconds);
        if (error) {
          for (const item of missing) item.deferred.resolve("");
          return;
        }
        const urlsByPath = new Map((data || []).map((item) => [item.path, item]));
        for (const item of missing) {
          const signedResult = urlsByPath.get(item.path);
          if (!signedResult?.signedUrl || signedResult.error) {
            item.deferred.resolve("");
            continue;
          }
          if (generation === cacheGenerations[clientScope]) {
            storeCacheEntry(item.key, signedResult.signedUrl, expiresInSeconds);
          }
          item.deferred.resolve(signedResult.signedUrl);
        }
      } catch {
        for (const item of missing) item.deferred.resolve("");
      } finally {
        for (const item of missing) {
          if (inFlightRequests.get(item.key) === item.deferred.promise) {
            inFlightRequests.delete(item.key);
          }
        }
      }
    })();
  }

  await Promise.all(requestsToAwait);
  return results;
};

export const clearSignedUrlCache = (clientScope?: ClientScope) => {
  if (!clientScope) {
    cacheGenerations.authenticated += 1;
    cacheGenerations.public += 1;
    signedUrlCache.clear();
    inFlightRequests.clear();
    return;
  }
  cacheGenerations[clientScope] += 1;
  const scopeMarker = `"clientScope":${JSON.stringify(clientScope)}`;
  for (const key of signedUrlCache.keys()) {
    if (key.includes(scopeMarker)) signedUrlCache.delete(key);
  }
  for (const key of inFlightRequests.keys()) {
    if (key.includes(scopeMarker)) inFlightRequests.delete(key);
  }
};
