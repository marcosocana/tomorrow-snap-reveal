import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import JSZip from 'jszip';

// Exercise the production queue with HTTP/2-style refusals and interrupted bodies.
// No requests are made to Supabase or to any other external service.
const source = fs.readFileSync(new URL('../src/lib/captainsContentDownload.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { downloadCaptainsContentFiles } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const originalFetch = globalThis.fetch;
const originalTimeout = globalThis.setTimeout;
const delay = ms => new Promise(resolve => originalTimeout(resolve, ms));
// Keep the production retry logic, with a short clock for deterministic tests.
globalThis.setTimeout = (callback, ms, ...args) => originalTimeout(callback, [700, 1800, 4000].includes(ms) ? 5 : ms, ...args);
try {
  const files = Array.from({ length: 150 }, (_, index) => ({ index, name: `file-${index}.jpg` }));
  const attempts = new Map();
  const blobs = new Map();
  const progress = [];
  let active = 0;
  let peak = 0;
  let signingAttempts = 0;
  globalThis.fetch = async url => {
    const index = Number(new URL(url).pathname.slice(1));
    const attempt = (attempts.get(index) || 0) + 1;
    attempts.set(index, attempt);
    active++; peak = Math.max(peak, active);
    if (active > 3) { active--; throw new TypeError('ERR_HTTP2_SERVER_REFUSED_STREAM'); }
    await delay(2);
    if (index === 83 && attempt === 1) { active--; throw new TypeError('Failed to fetch: ERR_HTTP2_SERVER_REFUSED_STREAM'); }
    if (index === 17 && attempt <= 2) {
      return { ok: false, status: attempt === 1 ? 429 : 503, body: { cancel: async () => { active--; } } };
    }
    return { ok: true, blob: async () => {
      try {
        await delay(3);
        if (index === 34 && attempt === 1) throw new TypeError('Interrupted response stream');
        return new Blob([`original content ${index}`]);
      } finally { active--; }
    } };
  };
  await downloadCaptainsContentFiles(files, {
    getUrl: async file => {
      if (file.index === 57 && signingAttempts++ === 0) throw new Error('Temporary signing failure');
      return `https://download.test/${file.index}`;
    },
    onFile: (file, blob, index) => { assert.equal(index, file.index); assert.equal(blobs.has(index), false); blobs.set(index, blob); },
    onProgress: (done, total) => { assert.equal(total, 150); progress.push(done); },
  });
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.equal(blobs.size, 150);
  assert.deepEqual(progress, Array.from({ length: 151 }, (_, i) => i));
  assert.equal(attempts.get(83), 2);
  assert.equal(attempts.get(17), 3);
  assert.equal(attempts.get(34), 2);
  const zip = new JSZip();
  for (const [index, blob] of blobs) zip.file(files[index].name, await blob.arrayBuffer());
  const archive = await JSZip.loadAsync(await zip.generateAsync({ type: 'uint8array', streamFiles: true }));
  assert.equal(Object.keys(archive.files).length, 150);
  for (const file of files) assert.equal(await archive.file(file.name).async('string'), `original content ${file.index}`);

  let fetched = 0;
  let delivered = 0;
  globalThis.fetch = async (_url, { signal }) => {
    const current = fetched++;
    if (current === 0) return { ok: false, status: 404, body: { cancel: async () => {} } };
    return { ok: true, blob: async () => {
      await delay(10);
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      return new Blob(['file']);
    } };
  };
  await assert.rejects(downloadCaptainsContentFiles(files, {
    getUrl: async file => `https://download.test/${file.index}`,
    onFile: () => delivered++, onProgress: () => {},
  }), /archivo 1 de 150/);
  assert.ok(fetched <= 3, 'A permanent failure must stop new downloads');
  assert.equal(delivered, 0);
  await delay(15);
  assert.equal(delivered, 0, 'No work may continue after the queue has rejected');

  fetched = 0;
  globalThis.fetch = async () => { fetched++; throw new TypeError('Persistent network failure'); };
  await assert.rejects(downloadCaptainsContentFiles([files[0]], {
    getUrl: async () => 'https://download.test/0', onFile: () => assert.fail('Must not deliver incomplete data'), onProgress: () => {},
  }), /archivo 1 de 1/);
  assert.equal(fetched, 4, 'Exhaustion must stop after four attempts');
  await downloadCaptainsContentFiles([], {
    getUrl: async () => assert.fail('Empty exports must not fetch'), onFile: () => {},
    onProgress: (done, total) => assert.deepEqual([done, total], [0, 0]),
  });
  console.log('PASS: 150 complete ZIP entries, max 3 active response streams, HTTP/2 refusal retry, 429/503, interrupted bodies, signing retry, progress, permanent failure cancellation and bounded retries.');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalTimeout;
}
