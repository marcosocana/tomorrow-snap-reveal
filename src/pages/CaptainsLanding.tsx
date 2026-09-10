import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Camera, Check, Film, HelpCircle, QrCode, Sparkles, Trophy, Users } from "lucide-react";
import captainArmbands from "@/assets/captains/captain-armbands.png";
import weddingParty from "@/assets/testimonial-wedding.jpg";
import "./CaptainsLanding.css";

const demoPath = "/capitanes/demo-capitanes-v2";

const challengeTypes = [
  { icon: Camera, label: "Fotos", title: "Momentos que solo podían captar ellos", text: "Retos para reunir a la mesa, mezclarse con otros invitados y guardar escenas irrepetibles." },
  { icon: Film, label: "Vídeos", title: "Brindis, bailes y mensajes inesperados", text: "Vídeos cortos grabados desde el juego, preparados para volver a vivirlos después de la boda." },
  { icon: HelpCircle, label: "Preguntas", title: "¿Quién conoce mejor a la pareja?", text: "Preguntas personalizadas sobre vuestra historia con puntuación automática e inmediata." },
];

const steps = [
  { number: "01", title: "Cada mesa elige capitán", text: "Los invitados escanean el QR, encuentran su mesa y eligen quién liderará el equipo." },
  { number: "02", title: "Los retos aparecen uno a uno", text: "Fotos, vídeos y preguntas mantienen la sorpresa y hacen que todo el mundo participe." },
  { number: "03", title: "La clasificación cobra vida", text: "Cada prueba suma puntos y el ranking cambia en directo durante toda la celebración." },
];

export default function CaptainsLanding() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Capitanes by Revelao · El juego para vuestra boda";
    return () => { document.title = previous; };
  }, []);

  return <div className="cl-page">
    <header className="cl-header">
      <div className="cl-nav">
        <Link to="/capitanes" className="cl-logo" aria-label="Capitanes, inicio"><img src="/capitanes-logo.svg" alt="Capitanes" /></Link>
        <nav aria-label="Navegación principal"><a href="#como-funciona">Cómo funciona</a><a href="#incluye">Qué incluye</a></nav>
        <Link to={demoPath} className="cl-button cl-button-small">Ver demo <ArrowRight size={16} /></Link>
      </div>
    </header>

    <main>
      <section className="cl-hero">
        <div className="cl-hero-copy">
          <span className="cl-kicker"><Sparkles size={15} /> El juego de vuestra boda</span>
          <h1>Una boda.<br />Muchas mesas.<br /><em>Una misión.</em></h1>
          <p>Convertid a vuestros invitados en protagonistas con retos, fotos, vídeos y preguntas que suceden en tiempo real.</p>
          <div className="cl-actions"><Link to={demoPath} className="cl-button">Probar la demo <ArrowRight size={18} /></Link><Link to="/nuevoeventocapitanes" className="cl-text-link">Crear mi partida</Link></div>
          <div className="cl-hero-notes"><span><Check size={15} /> Sin descargar ninguna app</span><span><Check size={15} /> Desde 4,95 € por mesa</span></div>
        </div>

        <div className="cl-hero-visual" aria-label="Vista previa del juego Capitanes">
          <span className="cl-orbit cl-orbit-one" /><span className="cl-orbit cl-orbit-two" />
          <img className="cl-armbands" src={captainArmbands} alt="Pulseras amarillas de capitán" />
          <div className="cl-phone">
            <div className="cl-phone-bar"><img src="/capitanes-logo.svg" alt="" /><span>75 <small>puntos</small></span></div>
            <div className="cl-phone-progress"><span>Vuestra aventura</span><strong>3 / 15 retos</strong><i><b /></i></div>
            <article className="cl-phone-card">
              <div><span>Reto 04</span><strong>+20 puntos</strong></div>
              <span className="cl-phone-icon"><Film size={38} /></span>
              <small>VÍDEO · 30 S</small>
              <h2>El brindis imposible</h2>
              <p>Grabad el brindis más divertido de vuestra mesa.</p>
              <span className="cl-phone-button">Aceptar reto</span>
            </article>
          </div>
          <span className="cl-score-pop"><Trophy size={19} /> +20 puntos</span>
        </div>
      </section>

      <section className="cl-trust" aria-label="Resumen de Capitanes">
        <div><strong>Hasta 25</strong><span>retos personalizables</span></div>
        <div><strong>100 % móvil</strong><span>sin registros ni descargas</span></div>
        <div><strong>En directo</strong><span>ranking y puntos al momento</span></div>
      </section>

      <section className="cl-section cl-intro" id="incluye">
        <div className="cl-section-heading"><span className="cl-kicker">Todos juegan</span><h2>La boda también ocurre en las mesas.</h2><p>Capitanes crea pequeñas misiones que conectan a los invitados y convierten lo espontáneo en recuerdos para siempre.</p></div>
        <div className="cl-type-grid">{challengeTypes.map(({ icon: Icon, label, title, text }) => <article key={label} className="cl-type-card"><span className="cl-type-icon"><Icon size={26} /></span><small>{label}</small><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="cl-story">
        <div className="cl-story-photo"><img src={weddingParty} alt="Invitados celebrando juntos en una boda" /><span>Los mejores momentos<br />no se pueden planear.</span></div>
        <div className="cl-story-copy"><span className="cl-kicker">Creado para bodas reales</span><h2>Mientras vosotros celebráis, ellos construyen el recuerdo.</h2><p>Las pruebas consiguen que los invitados se mezclen, se rían y graben todo aquello que los novios no pueden ver al mismo tiempo.</p><ul><li><Camera size={18} /><span><strong>Contenido auténtico</strong> desde el punto de vista de vuestros invitados.</span></li><li><Users size={18} /><span><strong>Participación compartida</strong> en cada mesa y durante toda la fiesta.</span></li><li><Trophy size={18} /><span><strong>Competición divertida</strong> con un ranking que mantiene la emoción.</span></li></ul></div>
      </section>

      <section className="cl-section cl-how" id="como-funciona">
        <div className="cl-section-heading"><span className="cl-kicker">Así de fácil</span><h2>Escanear. Jugar. Recordar.</h2></div>
        <div className="cl-step-grid">{steps.map(step => <article key={step.number}><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
        <div className="cl-demo-strip"><div><QrCode size={32} /><span><small>¿Queréis verlo en acción?</small><strong>Entrad en la boda demo y completad el primer reto.</strong></span></div><Link to={demoPath} className="cl-button">Abrir demo <ArrowRight size={18} /></Link></div>
      </section>

      <section className="cl-final">
        <img src={captainArmbands} alt="" aria-hidden="true" />
        <div><span className="cl-kicker">Vuestra boda, vuestro juego</span><h2>Que cada mesa tenga algo que contar.</h2><p>Configurad los capitanes, personalizad los retos y dejad que empiece la competición.</p><div className="cl-actions"><Link to="/nuevoeventocapitanes" className="cl-button">Crear mi partida <ArrowRight size={18} /></Link><Link to={demoPath} className="cl-text-link">Ver primero la demo</Link></div></div>
      </section>
    </main>

    <footer className="cl-footer"><img src="/capitanes-logo.svg" alt="Capitanes" /><span>Una experiencia de <a href="https://www.revelao.cam">Revelao.cam</a></span><span>Hecho para celebrar juntos.</span></footer>
  </div>;
}
