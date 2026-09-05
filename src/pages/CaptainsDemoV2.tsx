import { useEffect, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Camera, Check, ChevronRight, Crown, Film, Flag, HelpCircle, LockKeyhole, RotateCcw, Trophy, Users, Clock3, Loader2, UserRound, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import MediaCapture from "@/components/captains-v2/MediaCapture";
import { useCaptainsV2 } from "@/hooks/useCaptainsV2";
import { rankCaptainsTables } from "@/lib/captainsService";
import "./CaptainsDemoV2.css";

const teams = [
  { color: "#f38368", outfit: "#364456", skin: "#f5c6a4" },
  { color: "#b4a0e4", outfit: "#625080", skin: "#ffe0c7" },
  { color: "#a8be84", outfit: "#4f7f3a", skin: "#d5a17e" },
  { color: "#e6bd68", outfit: "#8a4f22", skin: "#926348" },
  { color: "#8db9cc", outfit: "#4d7a8a", skin: "#ecc29f" },
];
function Captain({ index, photoUrl }: { index: number; photoUrl?: string | null }) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const hasPhoto = Boolean(photoUrl && photoUrl !== failedPhoto);
  return <span className={`cv2-captain cv2-captain-${index} cv2-photo-captain`} aria-hidden="true">
    <span className="cv2-photo-head">
      {hasPhoto ? <img src={photoUrl!} alt="" onError={() => setFailedPhoto(photoUrl!)} /> : <UserRound size={25} strokeWidth={1.5} />}
    </span>
    <i className="cv2-body" /><i className="cv2-arm left" /><i className="cv2-arm right" /><i className="cv2-leg left" /><i className="cv2-leg right" />
  </span>;
}


type View = "quests" | "ranking" | "memories";
const captainStyle = (index: number): CSSProperties => ({
  "--island": teams[index % teams.length].color,
  "--outfit": teams[index % teams.length].outfit,
  "--skin": teams[index % teams.length].skin,
} as CSSProperties);

function VictoryCup() {
  return <div className="cv2-victory-cup" aria-hidden="true">
    <span className="cv2-victory-spark one">✦</span><span className="cv2-victory-spark two">✦</span>
    <svg viewBox="0 0 180 180" role="presentation">
      <defs><linearGradient id="cv2-gold" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#ffe2a7"/><stop offset=".48" stopColor="#f2aa5b"/><stop offset="1" stopColor="#ca684e"/></linearGradient></defs>
      <path d="M52 43h76v33c0 27-16 47-38 47S52 103 52 76V43Z" fill="url(#cv2-gold)" stroke="#2f292d" strokeWidth="5"/>
      <path d="M52 55H31c0 28 12 42 34 43M128 55h21c0 28-12 42-34 43" fill="none" stroke="#2f292d" strokeWidth="6" strokeLinecap="round"/>
      <path d="M90 123v18M66 151h48" stroke="#2f292d" strokeWidth="7" strokeLinecap="round"/>
      <path d="m90 59 7 14 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2 7-14Z" fill="#fff7e9"/>
    </svg>
    <span className="cv2-victory-shadow" />
  </div>;
}

function CaptainArmband() {
  return <svg className="cv2-armband" viewBox="8 10 134 104" aria-hidden="true">
    <defs>
      <linearGradient id="cv2-armband-main" x1="18" y1="16" x2="126" y2="102" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ffaaa0" /><stop offset=".48" stopColor="#f06a5f" /><stop offset="1" stopColor="#b9443c" />
      </linearGradient>
      <linearGradient id="cv2-armband-edge" x1="105" y1="25" x2="134" y2="92" gradientUnits="userSpaceOnUse">
        <stop stopColor="#d5554c" /><stop offset="1" stopColor="#8f332e" />
      </linearGradient>
      <radialGradient id="cv2-armband-badge" cx="35%" cy="28%" r="75%">
        <stop stopColor="#fffdf7" /><stop offset="1" stopColor="#f4dfce" />
      </radialGradient>
      <filter id="cv2-armband-shadow" x="-35%" y="-35%" width="180%" height="200%">
        <feDropShadow dx="5" dy="8" stdDeviation="6" floodColor="#6d3730" floodOpacity=".28" />
      </filter>
    </defs>
    <ellipse cx="75" cy="103" rx="48" ry="9" fill="#6d3730" opacity=".13" />
    <g filter="url(#cv2-armband-shadow)" transform="rotate(-7 75 57)">
      <path d="M34 26C17 34 15 78 36 91l16-13c-10-12-9-35 1-47L34 26Z" fill="#9c3a34" />
      <path d="M35 22c27-9 69-4 91 11l-8 61C93 80 61 77 34 88l1-66Z" fill="url(#cv2-armband-main)" stroke="#81322e" strokeWidth="3" strokeLinejoin="round" />
      <path d="M126 33c8 8 8 47-8 61l-9-8 7-58 10 5Z" fill="url(#cv2-armband-edge)" stroke="#81322e" strokeWidth="3" strokeLinejoin="round" />
      <path d="M43 31c22-6 51-3 70 7M41 78c22-7 48-5 69 4" fill="none" stroke="#ffd0ca" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 5" opacity=".9" />
      <path d="M42 27c22-7 49-4 68 3" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".23" />
      <circle cx="76" cy="57" r="25" fill="url(#cv2-armband-badge)" stroke="#9f4039" strokeWidth="3" />
      <circle cx="76" cy="57" r="20" fill="none" stroke="#e7bba9" strokeWidth="1.5" strokeDasharray="2 3" />
      <text x="76" y="67" textAnchor="middle" fill="#d45148" fontSize="30" fontWeight="850">C</text>
      <text x="76" y="86" textAnchor="middle" fill="#fff7f2" fontSize="6" fontWeight="800" letterSpacing="2">CAPITÁN</text>
    </g>
  </svg>;
}

export default function CaptainsDemoV2({ eventSlug: requestedEventSlug }: { eventSlug?: string } = {}) {
  const params = useParams();
  const eventSlug = requestedEventSlug || params.eventSlug || "demo-capitanes-v2";
  const game = useCaptainsV2(eventSlug);
  const [started, setStarted] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const selected = game.selected ?? choice;
  const joined = game.selected !== null;
  const [view, setView] = useState<View>("quests");
  const [mission, setMission] = useState<number | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [result, setResult] = useState({ correct: true, pointsAwarded: 0 });
  const [answer, setAnswer] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mediaPreparing, setMediaPreparing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [galleryTable, setGalleryTable] = useState("mine");
  const [rejecting, setRejecting] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: "photo" | "video"; title: string } | null>(null);
  const liveTeams = (game.data?.tables ?? []).map((table, index) => ({
    ...teams[index % teams.length], ...table, name: table.captain_name?.trim() || "Sin nombre", points: table.total_points,
  }));
  const team = selected === null ? null : liveTeams[selected];
  const name = team?.name;
  const missions = (game.rows.length ? game.rows.map(row => game.data!.challenges.find(item => item.id === row.challenge_id)!) : game.data?.challenges ?? []).map(item => ({
    ...item, type: `${item.evidence_type === "photo" ? "Foto" : item.evidence_type === "video" ? "Vídeo" : "Pregunta"}${item.has_time_limit ? ` · ${item.time_limit_seconds} s` : ""}`,
    icon: item.evidence_type === "photo" ? Camera : item.evidence_type === "video" ? Film : HelpCircle,
  }));
  const completed = game.completed;
  const finished = game.finished;
  const current = missions[completed];
  const points = team?.total_points ?? 0;
  const ranking = rankCaptainsTables(game.data?.tables ?? [], game.data?.rows ?? []).map(table => {
    const index = game.data!.tables.findIndex(item => item.id === table.id);
    return { ...teams[index % teams.length], ...table, name: table.captain_name?.trim() || "Sin nombre", points: table.total_points, index };
  });
  const position = ranking.findIndex(item => item.index === selected) + 1;
  const galleryTableId = galleryTable === "mine" ? team?.id : galleryTable;
  const memories = (game.gallery.data ?? []).filter(item => item.table_id === galleryTableId);
  const resultRows = (game.data?.rows ?? []).filter(row => row.table_id === galleryTableId && !(row.status === "failed" && !row.question_answer && !row.submitted_at)).sort((a, b) => a.randomized_order_index - b.randomized_order_index);
  const activeMission = mission === null ? null : missions[mission];
  const isQuestion = activeMission?.evidence_type === "question";
  const canSubmit = isQuestion ? Boolean(answer) : Boolean(file);
  const join = async () => {
    if (selected === null || !name) return;
    if (await game.join(selected, name)) window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openMission = async () => {
    if (!joined || finished || !game.currentRow) return;
    const id = game.currentRow.id;
    const index = completed;
    if (!await game.start()) return;
    setRowId(id); setMission(index); setCelebrating(false); setAnswer(null); setFile(null); setMediaPreparing(false); setUploadProgress(0);
  };
  const completeMission = async () => {
    if (!rowId) return;
    setUploadProgress(0);
    const outcome = await game.submit(rowId, file, answer, setUploadProgress);
    if (outcome) { setResult(outcome); setFile(null); setCelebrating(true); }
  };
  const rejectMission = async () => {
    if (!game.currentRow) return;
    if (await game.reject(game.currentRow.id)) {
      setRejecting(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };
  useEffect(() => {
    if (rowId && !game.busy && !celebrating && game.currentRow?.id !== rowId) setMission(null);
  }, [rowId, game.busy, game.currentRow?.id, celebrating]);
  const leave = () => { game.leave(); setChoice(null); setView("quests"); setMission(null); setFile(null); setMediaPreparing(false); };
  const navigate = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: "instant" }); };

  return <div className="cv2 cv2-mobile" style={{ "--team": team?.color ?? "#f06a5f" } as CSSProperties}>
    <header className="cv2-header">
      <Link to={`/capitanes/${eventSlug}`} className="cv2-brand" aria-label="Capitanes"><img src="/capitanes-logo.svg" alt="Capitanes" className="cv2-revelao-logo" /></Link>
    </header>
    <main className="cv2-mobile-main">
      {started && game.connectionError && <div className="cv2-connection-error" role="alert"><p>{game.connectionError}</p><button className="cv2-secondary" disabled={game.busy} onClick={() => void game.refresh()}>Volver a conectar <RotateCcw size={16} /></button></div>}
      {!started ? <section className="cv2-welcome" aria-labelledby="cv2-welcome-title">
        <div className="cv2-welcome-art" aria-hidden="true"><span className="cv2-welcome-orbit" /><span className="cv2-quest-object cv2-armband-object"><CaptainArmband /><span>✦</span></span></div>
        <h1 id="cv2-welcome-title">{game.data?.event.name ?? "Capitanes"}</h1>
        <p>{game.data?.event.description ?? "Reúne a tu mesa, superad los retos y cread recuerdos durante la celebración."}</p>
        <div className="cv2-join-bar"><button className="cv2-primary" onClick={() => { setStarted(true); window.scrollTo({ top: 0, behavior: "instant" }); }}>Empezar <ArrowRight size={18} /></button></div>
      </section> : !game.data ? <div className="cv2-loading" role="status">{game.loading && <Loader2 className="animate-spin" />}<h1>{game.loading ? "Preparando vuestra mesa…" : "Estamos preparando la partida"}</h1></div> : !joined ? <>
        <div className="cv2-intro"><div><h1>¿Qué capitán <em>eres?</em></h1><p>Encuentra tu mesa y elige quién eres.</p></div></div>
        <section className="cv2-identity" aria-labelledby="cv2-identity-title">
          <div className="cv2-identity-heading"><h2 id="cv2-identity-title" className="sr-only">Capitanes disponibles</h2></div>
          <div className="cv2-captain-picker">{liveTeams.map((item, index) => <button key={item.id} className={`cv2-pick ${selected === index ? "is-selected" : ""}`} style={captainStyle(index)} onClick={() => setChoice(index)} disabled={game.busy} aria-pressed={selected === index} aria-label={`${item.name}, ${item.table_name}`}>
            <span className="cv2-pick-check">{selected === index && <Check size={14} />}</span><span className="cv2-pick-stage"><span className="cv2-platform"><i /><i /><i /></span><Captain index={index} photoUrl={item.captain_photo_url} /></span><span className="cv2-pick-label"><strong>{item.name}</strong><small>{item.table_name}</small></span>
          </button>)}<div className="cv2-pick-message"><Crown size={26} strokeWidth={1.3} /><p>¡Confiamos en ti!</p></div></div>
        </section>
        <p className="cv2-onboarding-note"><LockKeyhole size={15} /> {missions.length} retos sorpresa. Se descubren uno a uno.</p>
        <div className="cv2-join-bar"><button className="cv2-primary" disabled={game.busy || selected === null || !name} onClick={join}>{game.busy ? "Entrando…" : "Continuar"}<ArrowRight size={18} /></button></div>
      </> : <>
        <section className="cv2-player-strip" aria-label="Tu equipo"><span className="cv2-player-avatar" style={captainStyle(selected!)}><Captain index={selected!} photoUrl={team?.captain_photo_url} /></span><div className="cv2-player-name"><small>VAMOS, {name?.toLocaleUpperCase("es")} ✦</small><h1 style={{ fontSize: (team?.table_name.length ?? 0) > 20 ? 15 : (team?.table_name.length ?? 0) > 13 ? 19 : 26 }}>{team?.table_name}</h1></div><div className="cv2-player-points"><strong>{points}</strong><span>puntos</span></div></section>
        <div className="cv2-mobile-progress"><div><span>{finished ? "¡Aventura completada!" : "Vuestra aventura"}</span><strong>{completed} / {missions.length} retos</strong></div><div className="cv2-progress" role="progressbar" aria-label="Retos finalizados" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={missions.length}>{missions.map((_, index) => <span key={index} className={index < completed ? "filled" : ""} />)}</div></div>
        {view === "quests" && <section className="cv2-mobile-quests" aria-labelledby="cv2-quests-title">
          <h2 id="cv2-quests-title" className="sr-only">Retos</h2>
          {finished ? <div className="cv2-finish"><VictoryCup /><span className="cv2-eyebrow">MISIÓN CUMPLIDA</span><h2>¡Lo habéis dado todo!</h2><p>{missions.length} retos, {points} puntos y una historia que ya es vuestra.</p><button className="cv2-primary cv2-centered-action" onClick={() => navigate("ranking")}>Ver nuestra posición</button><button className="cv2-secondary cv2-centered-action" onClick={() => navigate("memories")}>Revivir los recuerdos</button></div> : current ? <article className="cv2-active-quest">
            <div className="cv2-card-top"><span className="cv2-eyebrow"><span className="cv2-status-dot" /> RETO 0{completed + 1} DESBLOQUEADO</span><span className="cv2-points">{current.points} puntos</span></div><div className="cv2-quest-object"><current.icon size={52} strokeWidth={1.3} /><span>✦</span></div><span className="cv2-mission-type">{current.type}</span><h2>{current.title}</h2><p>{current.description}</p><button className="cv2-primary cv2-centered-action" disabled={game.busy} onClick={openMission}>{game.busy ? "Abriendo…" : game.currentRow?.status === "in_progress" ? "Continuar reto" : "Aceptar reto"}</button><button className="cv2-secondary cv2-reject-button" disabled={game.busy} onClick={() => setRejecting(true)}>Rechazar reto</button>
            {game.error && <p className="cv2-error" role="alert">{game.error}</p>}{game.currentRow?.status === "in_progress" && game.remaining !== null && <span className="cv2-timer"><Clock3 size={14} /> {game.remaining} s restantes</span>}<small className="cv2-unlock-hint"><LockKeyhole size={12} /> Termínalo para descubrir el siguiente</small>
          </article> : <p role="status">Preparando los retos de vuestra mesa…</p>}
          {!finished && <div className="cv2-mission-path" aria-label="Próximos retos">{missions.map((item, index) => ({ item, index })).filter(({ index }) => index > completed).map(({ item, index }) => {
            return <div key={item.id} className="cv2-locked-quest" aria-label={`Reto ${index + 1} bloqueado. Completa el reto anterior para descubrirlo.`}><span className="cv2-path-number">0{index + 1}</span><div className="cv2-locked-content" aria-hidden="true"><item.icon size={26} /><div><strong>{item.title}</strong><small>{item.type}</small></div></div><span className="cv2-lock-label"><LockKeyhole size={16} /> Reto sorpresa<span>Completa el anterior</span></span></div>;
          })}</div>}
        </section>}
        {view === "ranking" && <section className="cv2-mobile-ranking"><div className="cv2-view-intro"><span className="cv2-eyebrow">CADA RETO CUENTA</span><h2>Camino a la gloria.</h2><p>Vais en el puesto #{position}. ¡La fiesta sigue!</p><p className="cv2-ranking-rule"><Clock3 size={14} /> En caso de empate, gana la mesa que haya completado todos los retos en menos tiempo.</p></div><div className="cv2-podium">{[1, 0, 2].map(place => {
          const item = ranking[place];
          return item && <div key={item.id} className="cv2-podium-team" style={captainStyle(item.index)}><Captain index={item.index} photoUrl={item.captain_photo_url} /><span className={`cv2-podium-step place-${place}`}><Trophy size={place === 0 ? 29 : 20} /><b>{place + 1}</b><strong>{item.table_name}</strong><small>{item.points} puntos</small></span></div>;
        })}</div><div className="cv2-mobile-ranks">{ranking.map((item, place) => <div key={item.id} className={item.index === selected ? "is-you" : ""}><span>0{place + 1}</span><strong>{item.table_name}<small>{item.index === selected ? "Vuestro equipo" : item.name}</small></strong><b>{item.points} <small>pts</small></b>{place === 0 && <Crown size={18} />}</div>)}</div><p className="cv2-demo-note">Clasificación compartida · Se actualiza automáticamente</p></section>}
        {view === "memories" && finished && <section className="cv2-mobile-memories"><div className="cv2-view-intro"><span className="cv2-eyebrow">RESULTADOS</span><h2>Retos</h2><p>Revisa las fotos y vídeos de cada mesa.</p></div><label className="cv2-gallery-filter">Mesa<select value={galleryTable} onChange={event => setGalleryTable(event.target.value)}><option value="mine">Mi mesa</option>{liveTeams.filter(item => item.id !== team?.id).map(item => <option key={item.id} value={item.id}>{item.table_name}</option>)}</select></label>
          {game.gallery.isPending && <p role="status">Cargando los resultados…</p>}{game.gallery.error && <div role="alert"><p>No se han podido cargar los archivos.</p><button className="cv2-secondary" onClick={() => void game.gallery.refetch()}>Volver a cargar</button></div>}{!game.gallery.isPending && !game.gallery.error && resultRows.length === 0 && <p className="cv2-demo-note">Esta mesa todavía no tiene resultados.</p>}
          <div className="cv2-memory-grid">{resultRows.map((row, index) => {
            const table = liveTeams.find(table => table.id === row.table_id);
            const task = game.data!.challenges.find(task => task.id === row.challenge_id);
            const item = memories.find(item => item.table_challenge_id === row.id);
            const media = item ? { url: item.url, type: item.evidence_type === "video" ? "video" as const : "photo" as const, title: task?.title ?? "Reto" } : null;
            const successful = row.status === "completed";
            const status = successful ? `+${row.points_awarded} puntos` : row.status === "failed" ? "0 puntos" : row.status === "time_expired" ? "Tiempo agotado" : row.status === "pending" ? "Bloqueado" : row.status === "in_progress" ? "En juego" : "Disponible";
            return <article className="cv2-memory cv2-result-card" key={row.id}>
              {media ? <button className="cv2-memory-media" onClick={() => setPreviewMedia(media)}>{media.type === "video" ? <video src={media.url} muted playsInline preload="metadata" /> : <img src={media.url} alt={`${task?.title ?? "Reto"} · ${table?.table_name}`} loading="lazy" />}</button> : <span className={`cv2-result-placeholder ${successful ? "is-success" : ""}`}>{task?.evidence_type === "question" ? <HelpCircle size={35} /> : successful ? <Check size={35} /> : <LockKeyhole size={28} />}</span>}
              <span className="cv2-memory-caption"><small>RETO 0{index + 1} · {status}</small><strong>{row.status === "pending" ? "Reto sorpresa" : task?.title}</strong>{task?.evidence_type === "question" && row.question_answer && <span className="cv2-result-answer">Respuesta: {row.question_answer}</span>}{media && <button onClick={() => setPreviewMedia(media)}>Abrir {media.type === "video" ? "vídeo" : "foto"} <ArrowRight size={13} /></button>}</span>
            </article>;
          })}</div>
        </section>}
        <div className="cv2-session-footer"><span>Vuestra partida se guarda automáticamente</span><button onClick={leave} disabled={game.busy}><Users size={13} /> Cambiar de capitán</button></div>
        <nav className={`cv2-bottom-nav ${finished ? "has-results" : ""}`} aria-label="Vistas de tu equipo">{([{ id: "quests", label: "Retos", icon: Flag }, { id: "ranking", label: "Ranking", icon: Trophy }, ...(finished ? [{ id: "memories" as const, label: "Resultados", icon: Camera }] : [])] as const).map(tab => <button key={tab.id} aria-current={view === tab.id ? "page" : undefined} onClick={() => navigate(tab.id)}><tab.icon size={21} /><span>{tab.label}</span>{tab.id === "quests" && !finished && <i />}</button>)}</nav>
      </>}
    </main>
    <Dialog open={mission !== null} onOpenChange={open => { if (!open && !game.busy) { setMission(null); setFile(null); } }}><DialogContent className="cv2-dialog cv2-mobile-dialog">
      {activeMission && <><span className="cv2-eyebrow">{team?.table_name} · RETO 0{mission! + 1}</span><span className="cv2-dialog-icon">{celebrating ? result.correct ? <Check size={38} /> : <XCircle size={38} /> : <Flag size={38} />}</span><DialogTitle className="cv2-dialog-title">{celebrating ? result.correct ? isQuestion ? "¡Respuesta correcta!" : "¡Reto superado!" : "Respuesta incorrecta" : activeMission.title}</DialogTitle><DialogDescription>{celebrating ? `${result.correct ? `Sumáis ${result.pointsAwarded} puntos.` : "Esta vez la respuesta no era correcta. No sumáis puntos."} ${finished ? "¡Habéis completado toda la aventura!" : "El siguiente reto ya os está esperando."}` : activeMission.description}</DialogDescription>
        {celebrating ? <><div className="cv2-celebration-points">+{result.pointsAwarded}<span>puntos para vuestra mesa</span></div><button className="cv2-primary" onClick={() => { setMission(null); window.scrollTo({ top: 0, behavior: "instant" }); }}>{finished ? "Ver nuestra victoria" : "Descubrir siguiente reto"}<ArrowRight size={18} /></button></> : <>
          {isQuestion ? <div className="cv2-answer-options" role="group" aria-label="Elige una respuesta">{(activeMission.question_options ?? []).map(option => <button key={option} disabled={game.busy} onClick={() => { game.clearError(); setAnswer(option); }} aria-pressed={answer === option}>{option}{answer === option && <Check size={17} />}</button>)}</div> : <MediaCapture key={rowId} kind={activeMission.evidence_type === "photo" ? "photo" : "video"} file={file} onChange={value => { game.clearError(); setFile(value); }} onPreparingChange={setMediaPreparing} disabled={game.busy} />}
          <div className="cv2-dialog-detail"><span>{activeMission.type}</span><strong>{activeMission.points} puntos</strong></div>{game.remaining !== null && <span className="cv2-timer" role="timer"><Clock3 size={15} /> {game.remaining} s restantes</span>}{game.error && <p className="cv2-error" role="alert">{game.error}</p>}<button className="cv2-primary" aria-busy={game.busy || mediaPreparing} disabled={game.busy || mediaPreparing || !canSubmit || game.remaining === 0} onClick={completeMission}>{mediaPreparing ? `Preparando ${activeMission.evidence_type === "photo" ? "foto" : "vídeo"}…` : game.busy ? (isQuestion ? "Comprobando…" : `${activeMission.evidence_type === "photo" ? "Subiendo foto" : "Subiendo vídeo"}${uploadProgress > 0 ? ` · ${uploadProgress}%` : "…"}`) : isQuestion ? "Continuar" : activeMission.evidence_type === "photo" ? "Enviar foto" : "Enviar vídeo"}{game.busy || mediaPreparing ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}</button>
        </>}
      </>}
    </DialogContent></Dialog>
    <Dialog open={rejecting} onOpenChange={open => { if (!game.busy) setRejecting(open); }}><DialogContent className="cv2-dialog cv2-confirm-dialog">
      <span className="cv2-dialog-icon cv2-reject-icon"><XCircle size={38} /></span>
      <DialogTitle className="cv2-dialog-title">¿Rechazáis este reto?</DialogTitle>
      <DialogDescription>Este reto sumará 0 puntos y pasaréis directamente al siguiente. Esta decisión no se puede deshacer.</DialogDescription>
      <button className="cv2-primary" disabled={game.busy} onClick={rejectMission}>{game.busy ? "Rechazando…" : "Sí, rechazar reto"}{game.busy && <Loader2 size={18} className="animate-spin" />}</button>
      <button className="cv2-secondary" disabled={game.busy} onClick={() => setRejecting(false)}>Volver al reto</button>
    </DialogContent></Dialog>
    <Dialog open={previewMedia !== null} onOpenChange={open => { if (!open) setPreviewMedia(null); }}><DialogContent className="cv2-dialog cv2-media-dialog">
      <DialogTitle className="cv2-dialog-title">{previewMedia?.title}</DialogTitle>
      <DialogDescription className="sr-only">Vista ampliada del resultado del reto</DialogDescription>
      {previewMedia?.type === "video" ? <video src={previewMedia.url} controls autoPlay playsInline preload="metadata" /> : previewMedia && <img src={previewMedia.url} alt={previewMedia.title} />}
    </DialogContent></Dialog>
  </div>;
}
