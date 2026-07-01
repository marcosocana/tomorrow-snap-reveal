WITH seed_challenges (
  title,
  description,
  evidence_type,
  category,
  difficulty,
  default_points,
  has_time_limit,
  time_limit_seconds
) AS (
  VALUES
    ('Selfie de bienvenida', 'Haced una selfie de la mesa completa antes de empezar el juego.', 'photo', 'Bienvenida', 'easy', 10, false, NULL),
    ('Nombre de equipo', 'Grabad un audio diciendo el nombre oficial de vuestra mesa y vuestro grito de guerra.', 'audio', 'Bienvenida', 'easy', 10, true, 45),
    ('Pose de portada', 'Haced una foto como si vuestra mesa saliera en la portada de una revista.', 'photo', 'Foto grupal', 'easy', 10, false, NULL),
    ('Foto elegante', 'Haced una foto mostrando el look más elegante de vuestra mesa.', 'photo', 'Foto grupal', 'easy', 10, false, NULL),
    ('Todos a una', 'Haced una foto de toda la mesa haciendo el mismo gesto.', 'photo', 'Foto grupal', 'easy', 10, true, 45),
    ('Mesa congelada', 'Grabad un vídeo de toda la mesa quedándose congelada durante cinco segundos.', 'video', 'Vídeo', 'medium', 15, true, 60),
    ('Brindis de mesa', 'Haced una foto de toda la mesa brindando por los novios.', 'photo', 'Mesa', 'easy', 10, false, NULL),
    ('Brindis narrado', 'Grabad un audio con un brindis corto para los novios.', 'audio', 'Mesa', 'medium', 15, true, 60),
    ('La mesa más coordinada', 'Grabad un vídeo haciendo un movimiento sincronizado entre todos.', 'video', 'Mesa', 'medium', 20, true, 90),
    ('Foto con los novios', 'Conseguid una foto de alguien de la mesa con los novios.', 'photo', 'Novios', 'medium', 20, false, NULL),
    ('Consejo matrimonial', 'Grabad un audio con un consejo para los novios.', 'audio', 'Novios', 'special', 20, true, 90),
    ('Mensaje secreto', 'Grabad un vídeo corto dedicando un mensaje sorpresa a los novios.', 'video', 'Novios', 'special', 25, true, 120),
    ('Recuerdo favorito', 'Grabad un audio contando un recuerdo bonito con alguno de los novios.', 'audio', 'Emotivo', 'special', 20, true, 120),
    ('La foto más bonita', 'Capturad un momento bonito de la boda desde vuestra mesa.', 'photo', 'Emotivo', 'medium', 15, false, NULL),
    ('Declaración grupal', 'Grabad un vídeo corto diciendo algo bonito a los novios entre todos.', 'video', 'Emotivo', 'special', 25, true, 120),
    ('Abrazo colectivo', 'Haced una foto de la mesa dándose un abrazo o gesto cariñoso.', 'photo', 'Emotivo', 'easy', 10, false, NULL),
    ('Foto en la pista', 'Haced una foto de alguien de la mesa dándolo todo en la pista de baile.', 'photo', 'Baile', 'medium', 15, false, NULL),
    ('Paso imposible', 'Grabad un vídeo enseñando el paso de baile más raro de la mesa.', 'video', 'Baile', 'hard', 25, true, 90),
    ('Coreografía express', 'Grabad una coreografía de diez segundos con al menos tres personas.', 'video', 'Baile', 'medium', 20, true, 90),
    ('DJ por un minuto', 'Grabad un audio cantando el estribillo de una canción que debería sonar hoy.', 'audio', 'Baile', 'medium', 15, true, 60),
    ('Aliados de otra mesa', 'Haced una foto con alguien de otra mesa.', 'photo', 'Interacción', 'medium', 15, false, NULL),
    ('Intercambio de cumplidos', 'Grabad un audio diciendo un cumplido a otra mesa.', 'audio', 'Interacción', 'easy', 10, true, 45),
    ('Foto con desconocidos', 'Haced una foto con dos personas invitadas que no estén en vuestra mesa.', 'photo', 'Interacción', 'medium', 15, false, NULL),
    ('Reto diplomático', 'Grabad un vídeo convenciendo a otra mesa para que os anime.', 'video', 'Interacción', 'hard', 25, true, 90),
    ('Selfie imposible', 'Haced una selfie donde salga el mayor número posible de personas de la mesa.', 'photo', 'Divertido', 'easy', 10, true, 60),
    ('Momento película', 'Recread una escena dramática o divertida como si fuese una película.', 'video', 'Divertido', 'hard', 25, true, 120),
    ('La risa más contagiosa', 'Grabad un audio con la mejor carcajada de la mesa.', 'audio', 'Divertido', 'easy', 10, true, 30),
    ('Objeto misterioso', 'Haced una foto del objeto más inesperado que encontréis en la mesa.', 'photo', 'Divertido', 'easy', 10, false, NULL),
    ('Foto de celebración', 'Haced una foto de la mesa celebrando como si hubiese ganado la Champions.', 'photo', 'Fiesta', 'medium', 15, true, 45),
    ('Cántico de campeones', 'Grabad un audio con un cántico inventado para vuestra mesa.', 'audio', 'Fiesta', 'medium', 15, true, 60),
    ('Entrada triunfal', 'Grabad un vídeo entrando en plano como estrellas de la fiesta.', 'video', 'Fiesta', 'medium', 20, true, 90),
    ('Confeti humano', 'Haced una foto simulando una celebración épica sin usar confeti real.', 'photo', 'Fiesta', 'medium', 15, true, 60),
    ('Detalle del lugar', 'Haced una foto bonita de un detalle de la decoración o del espacio.', 'photo', 'Espacio', 'easy', 10, false, NULL),
    ('La mesa recomienda', 'Grabad un audio recomendando el mejor momento de la celebración hasta ahora.', 'audio', 'Espacio', 'medium', 15, true, 60),
    ('Mini tour', 'Grabad un vídeo de diez segundos enseñando vuestro rincón favorito del evento.', 'video', 'Espacio', 'medium', 20, true, 90),
    ('Final de película', 'Grabad un vídeo de despedida para el resumen final del evento.', 'video', 'Resumen', 'special', 25, true, 120)
)
INSERT INTO public.captains_challenge_catalog (
  title,
  description,
  evidence_type,
  category,
  difficulty,
  default_points,
  has_time_limit,
  time_limit_seconds,
  is_active
)
SELECT
  seed.title,
  seed.description,
  seed.evidence_type,
  seed.category,
  seed.difficulty,
  seed.default_points,
  seed.has_time_limit,
  seed.time_limit_seconds,
  true
FROM seed_challenges seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.captains_challenge_catalog existing
  WHERE lower(existing.title) = lower(seed.title)
);
