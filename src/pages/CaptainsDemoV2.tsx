import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, Check, ChevronRight, Crown, Film, Flag, HelpCircle, LockKeyhole, RotateCcw, Trophy, Users, Clock3, Loader2, UserRound, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import MediaCapture from "@/components/captains-v2/MediaCapture";
import { useCaptainsV2, isFinishedRow } from "@/hooks/useCaptainsV2";
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


type View = "quests" | "ranking" | "tables" | "memories";
const captainStyle = (index: number): CSSProperties => ({
  "--island": teams[index % teams.length].color,
  "--outfit": teams[index % teams.length].outfit,
  "--skin": teams[index % teams.length].skin,
} as CSSProperties);

export default function CaptainsDemoV2() {
  const game = useCaptainsV2();
  const [started, setStarted] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const selected = game.selected ?? choice;
  const joined = game.selected !== null;
  const [captainName, setCaptainName] = useState("");
  const [view, setView] = useState<View>("quests");
  const [mission, setMission] = useState<number | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [result, setResult] = useState({ correct: true, pointsAwarded: 0 });
  const [answer, setAnswer] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [galleryTable, setGalleryTable] = useState("all");
  const [inspectTable, setInspectTable] = useState<string | null>(null);
  const liveTeams = (game.data?.tables ?? []).map((table, index) => ({
    ...teams[index % teams.length], ...table, name: table.captain_name || "Sin capitán", points: table.total_points,
  }));
  const team = selected === null ? null : liveTeams[selected];
  const name = joined ? team?.name : team?.name === "Sin capitán" ? captainName.trim() : team?.name;
  const missions = (game.rows.length ? game.rows.map(row => game.data!.challenges.find(item => item.id === row.challenge_id)!) : game.data?.challenges ?? []).map(item => ({
    ...item, type: `${item.evidence_type === "photo" ? "Foto" : item.evidence_type === "video" ? "Vídeo" : "Pregunta"}${item.has_time_limit ? ` · ${item.time_limit_seconds} s` : ""}`,
    icon: item.evidence_type === "photo" ? Camera : item.evidence_type === "video" ? Film : HelpCircle,
  }));
  const completed = game.completed;
  const finished = game.finished;
  const current = missions[completed];
  const points = team?.total_points ?? 0;
  const ranking = liveTeams.map((item, index) => ({ ...item, index })).sort((a, b) => b.points - a.points || a.index - b.index);
  const position = ranking.findIndex(item => item.index === selected) + 1;
  const memories = (game.gallery.data ?? []).filter(item => galleryTable === "all" || item.table_id === galleryTable);
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
    setRowId(id); setMission(index); setCelebrating(false); setAnswer(null); setFile(null);
  };
  const completeMission = async () => {
    if (!rowId) return;
    const outcome = await game.submit(rowId, file, answer);
    if (outcome) { setResult(outcome); setFile(null); setCelebrating(true); }
  };
  useEffect(() => {
    if (rowId && !game.busy && !celebrating && game.currentRow?.id !== rowId) setMission(null);
  }, [rowId, game.busy, game.currentRow?.id, celebrating]);
  const leave = () => { game.leave(); setChoice(null); setView("quests"); setMission(null); setFile(null); };
  const navigate = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: "instant" }); };

  return <div className="cv2 cv2-mobile" style={{ "--team": team?.color ?? "#f06a5f" } as CSSProperties}>
    <header className="cv2-header">
      <Link to="/capitanes/demo-capitanes-v2" className="cv2-brand" aria-label="Revelao"><img src="/LogoMiniRevelao.svg" alt="Revelao" className="cv2-revelao-logo" /></Link>
      <span className="cv2-mobile-badge">CAPITANES</span>
    </header>
    <main className="cv2-mobile-main">
      {started && game.error && <div className="cv2-connection-error" role="alert"><p>{game.error}</p><button className="cv2-secondary" disabled={game.busy} onClick={() => void game.refresh()}>Volver a conectar <RotateCcw size={16} /></button></div>}
      {!started ? <section className="cv2-welcome" aria-labelledby="cv2-welcome-title">
        <div className="cv2-welcome-art" aria-hidden="true"><span className="cv2-welcome-orbit" /><span className="cv2-quest-object"><Flag size={56} strokeWidth={1.3} /><span>✦</span></span></div>
        <h1 id="cv2-welcome-title">Una gran mesa.<br /><em>Un gran equipo.</em></h1>
        <p>Bienvenidos a Capitanes. Reúne a tu mesa, cread recuerdos y superad pequeños retos durante la celebración.</p>
        <p>Cada reto os acerca a la victoria. Al final, podréis revivir los recuerdos de todas las mesas.</p>
        <div className="cv2-join-bar"><button className="cv2-primary" onClick={() => { setStarted(true); window.scrollTo({ top: 0, behavior: "instant" }); }}>Empezar <ArrowRight size={18} /></button></div>
      </section> : !game.data ? <div className="cv2-loading" role="status">{game.loading && <Loader2 className="animate-spin" />}<h1>{game.loading ? "Preparando vuestra mesa…" : "Estamos preparando la partida"}</h1></div> : !joined ? <>
        <div className="cv2-intro"><div><h1>Elige a tu <em>capitán.</em></h1><p>Encuentra tu mesa y elige quién eres.<br />Tu equipo te está esperando.</p></div></div>
        <section className="cv2-identity" aria-labelledby="cv2-identity-title">
          <div className="cv2-identity-heading"><h2 id="cv2-identity-title">¿Qué capitán eres?</h2><span>TU EQUIPO</span></div>
          <div className="cv2-captain-picker">{liveTeams.map((item, index) => <button key={item.id} className={`cv2-pick ${selected === index ? "is-selected" : ""}`} style={captainStyle(index)} onClick={() => setChoice(index)} disabled={game.busy} aria-pressed={selected === index} aria-label={`${item.name}, ${item.table_name}`}>
            <span className="cv2-pick-check">{selected === index && <Check size={14} />}</span><span className="cv2-pick-stage"><span className="cv2-platform"><i /><i /><i /></span><Captain index={index} photoUrl={item.captain_photo_url} /></span><span className="cv2-pick-label"><strong>{item.name === "Sin capitán" ? "Aquí faltas tú" : item.name}</strong><small>{item.table_name}</small></span>
          </button>)}<div className="cv2-pick-message"><Crown size={26} strokeWidth={1.3} /><p>La mejor mesa<br />empieza contigo.</p></div></div>
          {team?.name === "Sin capitán" && <label className="cv2-name-label">Tu nombre<input autoComplete="given-name" maxLength={40} value={captainName} onChange={event => setCaptainName(event.target.value)} placeholder="¿Cómo te llamas?" /></label>}
        </section>
        <p className="cv2-onboarding-note"><LockKeyhole size={15} /> {missions.length} retos sorpresa. Se descubren uno a uno.</p>
        <div className="cv2-join-bar"><button className="cv2-primary" disabled={game.busy || selected === null || !name} onClick={join}>{game.busy ? "Entrando…" : "Continuar"}<ArrowRight size={18} /></button></div>
      </> : <>
        <section className="cv2-player-strip" aria-label="Tu equipo"><span className="cv2-player-avatar" style={captainStyle(selected!)}><Captain index={selected!} photoUrl={team?.captain_photo_url} /></span><div><small>VAMOS, {name?.toLocaleUpperCase("es")} ✦</small><h1>{team?.table_name}</h1></div><div className="cv2-player-points"><strong>{points}</strong><span>puntos</span></div></section>
        <div className="cv2-mobile-progress"><div><span>{finished ? "¡Aventura completada!" : "Vuestra aventura"}</span><strong>{completed} / {missions.length} retos</strong></div><div className="cv2-progress" role="progressbar" aria-label="Retos finalizados" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={missions.length}>{missions.map((_, index) => <span key={index} className={index < completed ? "filled" : ""} />)}</div></div>
        {view === "quests" && <section className="cv2-mobile-quests" aria-labelledby="cv2-quests-title">
          <div className="cv2-identity-heading"><h2 id="cv2-quests-title">{finished ? "Una mesa para recordar." : "El siguiente recuerdo es vuestro."}</h2></div>
          {finished ? <div className="cv2-finish"><span className="cv2-finish-trophy"><Trophy size={76} /></span><span className="cv2-eyebrow">MISIÓN CUMPLIDA</span><h2>¡Lo habéis dado todo!</h2><p>{missions.length} retos, {points} puntos y una historia que ya es vuestra.</p><button className="cv2-primary" onClick={() => navigate("ranking")}>Ver nuestra posición <Trophy size={18} /></button><button className="cv2-secondary" onClick={() => navigate("memories")}>Revivir los recuerdos <Camera size={17} /></button></div> : current ? <article className="cv2-active-quest">
            <div className="cv2-card-top"><span className="cv2-eyebrow"><span className="cv2-status-dot" /> RETO 0{completed + 1} DESBLOQUEADO</span><span className="cv2-points">Hasta {current.points} pts</span></div><div className="cv2-quest-object"><current.icon size={52} strokeWidth={1.3} /><span>✦</span></div><span className="cv2-mission-type">{current.type}</span><h2>{current.title}</h2><p>{current.description}</p><button className="cv2-primary" disabled={game.busy} onClick={openMission}>{game.busy ? "Abriendo…" : game.currentRow?.status === "in_progress" ? "Continuar reto" : "Aceptar reto"}<ArrowRight size={18} /></button>
            {game.currentRow?.status === "in_progress" && game.remaining !== null && <span className="cv2-timer"><Clock3 size={14} /> {game.remaining} s restantes</span>}<small className="cv2-unlock-hint"><LockKeyhole size={12} /> Termínalo para descubrir el siguiente</small>
          </article> : <p role="status">Preparando los retos de vuestra mesa…</p>}
          <div className="cv2-mission-path" aria-label="Camino de retos">{missions.map((item, index) => ({ item, index })).filter(({ index }) => index !== completed).sort((a, b) => Number(a.index < completed) - Number(b.index < completed) || a.index - b.index).map(({ item, index }) => {
            const row = game.rows[index];
            return index > completed ? <div key={item.id} className="cv2-locked-quest" aria-label={`Reto ${index + 1} bloqueado. Completa el reto anterior para descubrirlo.`}><span className="cv2-path-number">0{index + 1}</span><div className="cv2-locked-content" aria-hidden="true"><item.icon size={26} /><div><strong>{item.title}</strong><small>{item.type}</small></div></div><span className="cv2-lock-label"><LockKeyhole size={16} /> Reto sorpresa<span>Completa el anterior</span></span></div> : <div key={item.id} className="cv2-done-quest"><span className="cv2-path-number"><Check size={17} /></span><div><strong>{item.title}</strong><small>{row?.status === "completed" ? "¡Superado en equipo!" : row?.status === "time_expired" ? "Tiempo agotado" : "Finalizado"}</small></div><span>+{row?.points_awarded ?? 0}</span></div>;
          })}</div>
        </section>}
        {view === "ranking" && <section className="cv2-mobile-ranking"><div className="cv2-view-intro"><span className="cv2-eyebrow">CADA RETO CUENTA</span><h2>Camino a la gloria.</h2><p>Vais en el puesto #{position}. ¡La fiesta sigue!</p></div><div className="cv2-podium">{[1, 0, 2].map(place => {
          const item = ranking[place];
          return item && <div key={item.id} className="cv2-podium-team" style={captainStyle(item.index)}><Captain index={item.index} photoUrl={item.captain_photo_url} /><span className={`cv2-podium-step place-${place}`}><Trophy size={place === 0 ? 29 : 20} /><b>{place + 1}</b><strong>{item.table_name}</strong><small>{item.points} puntos</small></span></div>;
        })}</div><div className="cv2-mobile-ranks">{ranking.map((item, place) => <div key={item.id} className={item.index === selected ? "is-you" : ""}><span>0{place + 1}</span><strong>{item.table_name}<small>{item.index === selected ? "Vuestro equipo" : item.name}</small></strong><b>{item.points} <small>pts</small></b>{place === 0 && <Crown size={18} />}</div>)}</div><p className="cv2-demo-note">Clasificación compartida · Se actualiza automáticamente</p></section>}
        {view === "tables" && <section className="cv2-all-tables"><div className="cv2-view-intro"><span className="cv2-eyebrow">LA FIESTA ES DE TODOS</span><h2>Cada mesa, una aventura.</h2><p>Sigue los retos y el progreso de todos los equipos.</p></div>{liveTeams.map((item, index) => {
          const tableRows = game.data!.rows.filter(row => row.table_id === item.id).sort((a, b) => a.randomized_order_index - b.randomized_order_index);
          return <div className="cv2-table-overview" key={item.id}><button aria-expanded={inspectTable === item.id} onClick={() => setInspectTable(inspectTable === item.id ? null : item.id)}><span style={captainStyle(index)} className="cv2-player-avatar"><Captain index={index} photoUrl={item.captain_photo_url} /></span><strong>{item.table_name}<small>{tableRows.filter(isFinishedRow).length} / {tableRows.length} retos · {item.total_points} puntos</small></strong><ChevronRight size={18} /></button>{inspectTable === item.id && <div className="cv2-table-missions">{tableRows.map((row, order) => {
            const task = game.data!.challenges.find(task => task.id === row.challenge_id);
            const done = isFinishedRow(row);
            return <div key={row.id}><span>0{order + 1}</span><strong>{row.status === "pending" ? "Reto sorpresa" : task?.title}<small>{row.status === "completed" ? "Superado" : done ? "Finalizado" : row.status === "in_progress" ? "En juego" : row.status === "pending" ? "Bloqueado" : "Disponible"}</small></strong>{done ? <Check size={16} /> : row.status === "pending" ? <LockKeyhole size={16} /> : <Flag size={16} />}</div>;
          })}</div>}</div>;
        })}</section>}
        {view === "memories" && finished && <section className="cv2-mobile-memories"><div className="cv2-view-intro"><span className="cv2-eyebrow">VUESTRA VERDADERA VICTORIA</span><h2>Esto se queda.</h2><p>Las fotos y vídeos de todas las mesas, juntos.</p></div><label className="cv2-gallery-filter">Ver recuerdos de<select value={galleryTable} onChange={event => setGalleryTable(event.target.value)}><option value="all">Todas las mesas</option>{liveTeams.map(item => <option key={item.id} value={item.id}>{item.table_name}</option>)}</select></label>
          {game.gallery.isPending && <p role="status">Revelando los recuerdos…</p>}{game.gallery.error && <div role="alert"><p>No se han podido cargar los recuerdos.</p><button className="cv2-secondary" onClick={() => void game.gallery.refetch()}>Volver a cargar</button></div>}{!game.gallery.isPending && !game.gallery.error && memories.length === 0 && <p className="cv2-demo-note">Esta mesa todavía no tiene recuerdos.</p>}
          <div className="cv2-memory-grid">{memories.map(item => {
            const table = liveTeams.find(table => table.id === item.table_id);
            const row = game.data!.rows.find(row => row.id === item.table_challenge_id);
            const task = game.data!.challenges.find(task => task.id === row?.challenge_id);
            return <div className="cv2-memory" key={item.id}>{item.evidence_type === "video" ? <video src={item.url} controls playsInline preload="metadata" /> : <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={`${task?.title ?? "Recuerdo"} · ${table?.table_name}`} loading="lazy" /></a>}<span className="cv2-memory-caption"><small>{table?.table_name} · {item.captain_name}</small><strong>{task?.title}</strong><a href={item.url} target="_blank" rel="noreferrer">Abrir {item.evidence_type === "video" ? "vídeo" : "foto"} <ArrowRight size={13} /></a></span></div>;
          })}</div>
        </section>}
        <div className="cv2-session-footer"><span>Vuestra partida se guarda automáticamente</span><button onClick={leave} disabled={game.busy}><Users size={13} /> Cambiar de capitán</button></div>
        <nav className={`cv2-bottom-nav ${finished ? "has-memories" : ""}`} aria-label="Vistas de tu equipo">{([{ id: "quests", label: "Retos", icon: Flag }, { id: "ranking", label: "Ranking", icon: Trophy }, { id: "tables", label: "Mesas", icon: Users }, ...(finished ? [{ id: "memories" as const, label: "Recuerdos", icon: Camera }] : [])] as const).map(tab => <button key={tab.id} aria-current={view === tab.id ? "page" : undefined} onClick={() => navigate(tab.id)}><tab.icon size={21} /><span>{tab.label}</span>{tab.id === "quests" && !finished && <i />}</button>)}</nav>
      </>}
    </main>
    <Dialog open={mission !== null} onOpenChange={open => { if (!open && !game.busy) { setMission(null); setFile(null); } }}><DialogContent className="cv2-dialog cv2-mobile-dialog">
      {activeMission && <><span className="cv2-eyebrow">{team?.table_name} · RETO 0{mission! + 1}</span><span className="cv2-dialog-icon">{celebrating ? result.correct ? <Check size={38} /> : <XCircle size={38} /> : <Flag size={38} />}</span><DialogTitle className="cv2-dialog-title">{celebrating ? result.correct ? isQuestion ? "¡Respuesta correcta!" : "¡Reto superado!" : "Respuesta incorrecta" : activeMission.title}</DialogTitle><DialogDescription>{celebrating ? `${result.correct ? `Sumáis ${result.pointsAwarded} puntos.` : "Esta vez la respuesta no era correcta. No sumáis puntos."} ${finished ? "¡Habéis completado toda la aventura!" : "El siguiente reto ya os está esperando."}` : activeMission.description}</DialogDescription>
        {celebrating ? <><div className="cv2-celebration-points">+{result.pointsAwarded}<span>puntos para vuestra mesa</span></div><button className="cv2-primary" onClick={() => { setMission(null); window.scrollTo({ top: 0, behavior: "instant" }); }}>{finished ? "Ver nuestra victoria" : "Descubrir siguiente reto"}<ArrowRight size={18} /></button></> : <>
          {isQuestion ? <div className="cv2-answer-options" role="group" aria-label="Elige una respuesta">{(activeMission.question_options ?? []).map(option => <button key={option} disabled={game.busy} onClick={() => setAnswer(option)} aria-pressed={answer === option}>{option}{answer === option && <Check size={17} />}</button>)}</div> : <MediaCapture key={rowId} kind={activeMission.evidence_type === "photo" ? "photo" : "video"} file={file} onChange={setFile} disabled={game.busy} />}
          <div className="cv2-dialog-detail"><span>{activeMission.type}</span><strong>Hasta {activeMission.points} puntos</strong></div>{game.remaining !== null && <span className="cv2-timer" role="timer"><Clock3 size={15} /> {game.remaining} s restantes</span>}{game.error && <p className="cv2-error" role="alert">{game.error}</p>}<button className="cv2-primary" disabled={game.busy || !canSubmit || game.remaining === 0} onClick={completeMission}>{game.busy ? "Enviando…" : isQuestion ? "Confirmar respuesta" : activeMission.evidence_type === "photo" ? "Enviar foto" : "Enviar vídeo"}{game.busy ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />}</button>
        </>}
      </>}
    </DialogContent></Dialog>
  </div>;
}
