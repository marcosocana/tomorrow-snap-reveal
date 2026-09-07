import type { CaptainsHostTone, CaptainsHostTrigger } from "@/lib/captainsTypes";

export type HostMessageTemplate = { speaker: "character_1" | "character_2" | "both"; line1: string; line2?: string; cta?: string };

const base: Record<CaptainsHostTrigger, HostMessageTemplate[]> = {
  GAME_STARTED: [{ speaker: "both", line1: "¡Bienvenidos, {teamName}!", line2: "Desde ahora sois oficialmente parte del juego.", cta: "Vamos" }, { speaker: "both", line1: "{teamName}, por fin estáis aquí.", line2: "Que empiece el juego.", cta: "Vamos" }],
  FIRST_CHALLENGE_COMPLETED: [{ speaker: "both", line1: "Primer reto superado.", line2: "Ya no podéis decir que no sabíais dónde os metíais." }],
  POINTS_25: [{ speaker: "character_1", line1: "Ya tenéis {points} puntos.", line2: "Esto empieza a moverse." }],
  POINTS_50: [{ speaker: "both", line1: "¡Ya habéis superado los 50 puntos!", line2: "Vale, quizá sí sepáis lo que estáis haciendo." }, { speaker: "both", line1: "50 puntos para {teamName}.", line2: "Esto empieza a ponerse interesante." }],
  POINTS_100: [{ speaker: "both", line1: "100 puntos.", line2: "Ahora empezamos a tomaros en serio." }],
  HALFWAY_CHALLENGES: [{ speaker: "both", line1: "Tenemos noticias.", line2: "¡Habéis completado la mitad de los retos!" }, { speaker: "both", line1: "{partner1} y {partner2} llevan {yearsTogether} años juntos.", line2: "Vosotros ya habéis completado la mitad de los retos." }],
  ENTERED_PODIUM: [{ speaker: "both", line1: "Atención.", line2: "Acabáis de entrar en el podio.", cta: "Ver clasificación" }],
  LEFT_PODIUM: [{ speaker: "character_2", line1: "El podio se ha movido.", line2: "Todavía podéis recuperarlo." }],
  BECAME_LEADER: [{ speaker: "both", line1: "Tenemos nuevos líderes.", line2: "Y sois vosotros.", cta: "Ver clasificación" }],
  LOST_LEAD: [{ speaker: "both", line1: "Os acaban de quitar el primer puesto.", line2: "Que no se acomoden." }],
  TEAM_OVERTAKEN: [{ speaker: "character_2", line1: "Malas noticias.", line2: "{otherTeam} os acaba de adelantar." }],
  THREE_QUARTERS_CHALLENGES: [{ speaker: "character_1", line1: "¡Ya habéis completado el 75 % de los retos!", line2: "Entramos en la recta final." }],
  LAST_CHALLENGE: [{ speaker: "both", line1: "¡Solo os queda un reto!", line2: "Vamos a cerrar esta aventura por todo lo alto." }],
  FINAL_CHALLENGES: [{ speaker: "both", line1: "Solo os quedan dos retos.", line2: "El final ya está aquí." }, { speaker: "both", line1: "Todo esto termina hoy en {venue}.", line2: "A vosotros solo os quedan dos retos." }],
  GAME_FINISHED: [{ speaker: "both", line1: "Se acabó.", line2: "Habéis terminado Capitanes con {points} puntos.", cta: "Continuar" }],
};

const toneLine: Record<CaptainsHostTone, Partial<Record<CaptainsHostTrigger, string>>> = {
  divertido: {},
  elegante: {
    GAME_STARTED: "Esperamos que disfrutéis del juego.", POINTS_50: "Un gran resultado. Seguid así.",
    POINTS_100: "Una puntuación excelente.", GAME_FINISHED: "Gracias por formar parte de esta celebración.",
  },
  gamberro: {
    GAME_STARTED: "Esperábamos algo más de puntualidad, pero os lo perdonamos.", POINTS_50: "Tampoco os vengáis arriba.",
    POINTS_100: "Ahora sí empezamos a tomaros en serio.", ENTERED_PODIUM: "No sabemos cómo, pero estáis en el podio.",
  },
  epico: {
    GAME_STARTED: "Hoy comienza vuestra leyenda.", POINTS_50: "Habéis cruzado la primera frontera.",
    POINTS_100: "La gloria está cada vez más cerca.", GAME_FINISHED: "Vuestra aventura ya forma parte de la historia.",
  },
  romantico: {
    GAME_STARTED: "Celebrad, jugad y cread un recuerdo juntos.", POINTS_50: "Cada punto también guarda un recuerdo.",
    HALFWAY_CHALLENGES: "La mitad de los retos, un montón de recuerdos compartidos.", GAME_FINISHED: "Gracias por llenar esta noche de recuerdos.",
  },
};

export const interpolateHostMessage = (text: string, context: Record<string, string | number | null | undefined>) =>
  text.replace(/\{(\w+)\}/g, (token, key: string) => {
    const value = context[key];
    return value === null || value === undefined || value === "" ? "" : String(value);
  }).replace(/\s+([,.!?])/g, "$1").replace(/\s+/g, " ").trim();

export const getHostMessageFromCatalog = (trigger: CaptainsHostTrigger, tone: CaptainsHostTone, variant: number, context: Record<string, string | number | null | undefined>) => {
  const complete = base[trigger].filter(template => [template.line1, template.line2 || ""].every(line => [...line.matchAll(/\{(\w+)\}/g)].every(match => context[match[1]] !== null && context[match[1]] !== undefined && context[match[1]] !== "")));
  const withoutMissingContext = base[trigger].filter(template => !/[{]\w+[}]/.test(`${template.line1}${template.line2 || ""}`));
  const templates = complete.length ? complete : withoutMissingContext.length ? withoutMissingContext : base[trigger];
  const selected = templates[Math.abs(variant) % templates.length];
  const alternateLine = toneLine[tone][trigger];
  return {
    ...selected,
    line1: interpolateHostMessage(selected.line1, context),
    line2: interpolateHostMessage(alternateLine || selected.line2 || "", context),
  };
};
