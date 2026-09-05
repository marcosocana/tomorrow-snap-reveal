import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getCaptainsEventDetail, getCaptainsTableChallenges, selectCaptainsTableSession,
  startCaptainsTableChallenge, uploadCaptainsEvidence, completeCaptainsQuestionChallenge,
  expireCaptainsTableChallenge, failCaptainsTableChallenge, getCaptainsEvidence, getCaptainsEvidenceSignedUrl,
} from "@/lib/captainsService";
import type { CaptainsTableChallenge } from "@/lib/captainsTypes";

export const CAPTAINS_V2_SLUG = "demo-capitanes-v2";
const sessionKeyForEvent = (eventSlug: string) => `captains-v2-player:${eventSlug}`;
export const isFinishedRow = (row: CaptainsTableChallenge) => ["completed", "failed", "time_expired", "rejected", "deleted"].includes(row.status);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "No se ha podido conectar. Vuelve a intentarlo.";

export function useCaptainsV2(eventSlug = CAPTAINS_V2_SLUG) {
  const sessionKey = sessionKeyForEvent(eventSlug);
  const [tableId, setTableId] = useState<string | null>(() => {
    try { return localStorage.getItem(sessionKey); } catch { return null; }
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const query = useQuery({
    queryKey: ["captains-v2", eventSlug],
    queryFn: async () => {
      const detail = await getCaptainsEventDetail(eventSlug);
      if (!detail) throw new Error("Esta partida todavía no está disponible. Vuelve a intentarlo en unos minutos.");
      const rows = await getCaptainsTableChallenges(detail.event.id);
      return { ...detail, rows };
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  useEffect(() => {
    try { setTableId(localStorage.getItem(sessionKey)); } catch { setTableId(null); }
  }, [sessionKey]);
  const data = query.data;
  const selected = data?.tables.findIndex(table => table.id === tableId) ?? -1;
  const rows = (data?.rows.filter(row => row.table_id === tableId) ?? []).sort((a, b) => a.randomized_order_index - b.randomized_order_index);
  const completed = rows.filter(isFinishedRow).length;
  const finished = rows.length > 0 && rows.every(isFinishedRow);
  const currentRow = rows.find(row => !isFinishedRow(row));
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!currentRow?.started_at || finished) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [currentRow?.started_at, finished]);
  const challenge = data?.challenges.find(item => item.id === currentRow?.challenge_id);
  const elapsed = currentRow?.started_at ? Math.max(0, Math.floor((now - Date.parse(currentRow.started_at)) / 1000)) : 0;
  const remaining = challenge?.has_time_limit ? Math.max(0, (challenge.time_limit_seconds ?? 0) - elapsed) : null;

  const run = async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try { return await operation(); }
    catch (cause) { setError(errorMessage(cause)); return undefined; }
    finally { lock.current = false; setBusy(false); }
  };
  const join = (index: number, name: string) => run(async () => {
    if (!data || !name.trim()) return false;
    const table = data.tables[index];
    await selectCaptainsTableSession(table.id, name);
    await query.refetch();
    setTableId(table.id);
    try { localStorage.setItem(sessionKey, table.id); } catch { /* The current visit still works. */ }
    return true;
  });
  const start = () => run(async () => {
    if (!currentRow || !data || !["pending", "ready", "in_progress"].includes(currentRow.status)) throw new Error("Este reto aún no está disponible.");
    const fresh = await getCaptainsTableChallenges(data.event.id);
    const row = fresh.find(item => item.id === currentRow.id);
    if (!row || isFinishedRow(row)) { await query.refetch(); throw new Error("Tu mesa ya ha terminado este reto. Hemos actualizado la partida."); }
    if (row.status !== "in_progress") await startCaptainsTableChallenge(row.id);
    await query.refetch();
    setNow(Date.now());
    return true;
  });
  const submit = (rowId: string, file: File | null, thumbnail: File | null, answer: string | null, onProgress?: (percentage: number) => void) => run(async () => {
    if (!data || !tableId) return;
    const fresh = await getCaptainsTableChallenges(data.event.id);
    const row = fresh.find(item => item.id === rowId);
    if (!row || row.status !== "in_progress") { await query.refetch(); throw new Error("El estado del reto ha cambiado. Vuelve a abrirlo."); }
    const item = data.challenges.find(item => item.id === row.challenge_id)!;
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(row.started_at!)) / 1000));
    const remainingSeconds = item.has_time_limit ? Math.max(0, (item.time_limit_seconds ?? 0) - elapsedSeconds) : null;
    if (remainingSeconds === 0) {
      await expireCaptainsTableChallenge(row.id);
      await query.refetch();
      throw new Error("Se ha agotado el tiempo. El siguiente reto ya está disponible.");
    }
    let result: { correct: boolean; pointsAwarded: number };
    if (item.evidence_type === "question") {
      if (!answer) throw new Error("Selecciona una respuesta.");
      result = await completeCaptainsQuestionChallenge({ eventId: data.event.id, tableId, tableChallengeId: row.id, answer, elapsedSeconds, remainingSeconds });
    } else {
      const fallbackMatches = file && (item.evidence_type === "photo"
        ? /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
        : /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name));
      if (!file || !(file.type.startsWith(item.evidence_type === "photo" ? "image/" : "video/") || (!file.type && fallbackMatches))) throw new Error("Añade el archivo del reto antes de enviarlo.");
      const evidence = await uploadCaptainsEvidence({ eventId: data.event.id, tableId, tableChallengeId: row.id, captainName: data.tables[selected]?.captain_name, evidenceType: item.evidence_type, file, thumbnail, elapsedSeconds, remainingSeconds, scoringMode: "automatic", onProgress });
      result = { correct: true, pointsAwarded: evidence.points_awarded };
    }
    await query.refetch();
    return result;
  });
  const reject = (rowId: string) => run(async () => {
    if (!data || !tableId) return false;
    const fresh = await getCaptainsTableChallenges(data.event.id);
    const row = fresh.find(item => item.id === rowId);
    if (!row || !["pending", "ready", "in_progress"].includes(row.status)) {
      await query.refetch();
      throw new Error("El estado del reto ha cambiado. Hemos actualizado la partida.");
    }
    await failCaptainsTableChallenge(row.id);
    await query.refetch();
    return true;
  });
  const expiring = useRef("");
  const refresh = query.refetch;
  useEffect(() => {
    if (remaining !== 0 || currentRow?.status !== "in_progress" || busy || expiring.current === currentRow.id) return;
    const rowId = currentRow.id;
    expiring.current = rowId;
    void expireCaptainsTableChallenge(rowId).then(() => refresh()).catch(cause => { setError(errorMessage(cause)); expiring.current = ""; });
  }, [remaining, currentRow?.id, currentRow?.status, busy, refresh]);

  const gallery = useQuery({
    queryKey: ["captains-v2-gallery", data?.event.id],
    enabled: Boolean(data && finished),
    queryFn: async () => {
      const evidence = await getCaptainsEvidence(data!.event.id, "approved");
      return Promise.all(evidence.map(async item => ({
        ...item,
        url: item.evidence_type === "video" ? "" : await getCaptainsEvidenceSignedUrl(item.file_url),
        thumbnailUrl: item.thumbnail_url ? await getCaptainsEvidenceSignedUrl(item.thumbnail_url) : "",
      })));
    },
    staleTime: 30000,
    refetchInterval: finished ? 15000 : false,
    refetchIntervalInBackground: false,
  });
  const leave = () => {
    setTableId(null);
    try { localStorage.removeItem(sessionKey); } catch { /* No persistent identity. */ }
  };
  return {
    data,
    selected: selected < 0 ? null : selected,
    rows,
    completed,
    finished,
    currentRow,
    remaining,
    busy,
    error,
    connectionError: query.error ? errorMessage(query.error) : "",
    loading: query.isPending,
    clearError: () => setError(""),
    refresh: () => { setError(""); return query.refetch(); },
    join,
    start,
    submit,
    reject,
    leave,
    gallery,
  };
}
