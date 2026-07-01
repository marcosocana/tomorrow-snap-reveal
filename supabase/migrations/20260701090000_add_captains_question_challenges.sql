ALTER TABLE public.captains_challenge_catalog
  ADD COLUMN IF NOT EXISTS question_options text[],
  ADD COLUMN IF NOT EXISTS question_correct_option text;

ALTER TABLE public.captains_event_challenges
  ADD COLUMN IF NOT EXISTS question_options text[],
  ADD COLUMN IF NOT EXISTS question_correct_option text;

UPDATE public.captains_challenge_catalog
SET
  evidence_type = 'video',
  category = CASE WHEN category = 'Audio' THEN 'Vídeo' ELSE category END,
  description = replace(
    replace(
      replace(
        replace(description, 'Grabad un audio', 'Grabad un vídeo'),
        'un audio',
        'un vídeo'
      ),
      'en audio',
      'en vídeo'
    ),
    'audio',
    'vídeo'
  )
WHERE evidence_type = 'audio';

UPDATE public.captains_event_challenges
SET
  evidence_type = 'video',
  category = CASE WHEN category = 'Audio' THEN 'Vídeo' ELSE category END,
  description = replace(
    replace(
      replace(
        replace(description, 'Grabad un audio', 'Grabad un vídeo'),
        'un audio',
        'un vídeo'
      ),
      'en audio',
      'en vídeo'
    ),
    'audio',
    'vídeo'
  )
WHERE evidence_type = 'audio';

UPDATE public.captains_evidence
SET evidence_type = 'video'
WHERE evidence_type = 'audio';

ALTER TABLE public.captains_challenge_catalog
  DROP CONSTRAINT IF EXISTS captains_challenge_catalog_evidence_type_check;

ALTER TABLE public.captains_event_challenges
  DROP CONSTRAINT IF EXISTS captains_event_challenges_evidence_type_check;

ALTER TABLE public.captains_evidence
  DROP CONSTRAINT IF EXISTS captains_evidence_evidence_type_check;

ALTER TABLE public.captains_challenge_catalog
  ADD CONSTRAINT captains_challenge_catalog_evidence_type_check
  CHECK (evidence_type IN ('photo', 'video', 'question'));

ALTER TABLE public.captains_event_challenges
  ADD CONSTRAINT captains_event_challenges_evidence_type_check
  CHECK (evidence_type IN ('photo', 'video', 'question'));

ALTER TABLE public.captains_evidence
  ADD CONSTRAINT captains_evidence_evidence_type_check
  CHECK (evidence_type IN ('photo', 'video'));

WITH question_challenges (
  title,
  description,
  default_points,
  difficulty,
  question_options,
  question_correct_option
) AS (
  VALUES
    ('¿Dónde fue la primera cita de la pareja?', '¿Dónde fue la primera cita de la pareja?', 10, 'easy', ARRAY['En un restaurante', 'En la playa', 'En un concierto', 'En casa de amigos']::text[], 'En un restaurante'),
    ('¿Quién dijo primero te quiero?', '¿Quién dijo primero te quiero?', 10, 'easy', ARRAY['La novia', 'El novio', 'Lo dijeron a la vez', 'No se acuerdan']::text[], 'La novia'),
    ('¿Cuál es el plan favorito de la pareja?', '¿Cuál es el plan favorito de la pareja?', 10, 'easy', ARRAY['Viajar', 'Cine y manta', 'Salir a bailar', 'Cocinar juntos']::text[], 'Viajar'),
    ('¿Dónde se prometieron?', '¿Dónde se prometieron?', 10, 'easy', ARRAY['En un viaje', 'En casa', 'En una cena', 'En la playa']::text[], 'En un viaje'),
    ('¿Qué comida les gusta compartir?', '¿Qué comida les gusta compartir?', 10, 'easy', ARRAY['Pizza', 'Sushi', 'Tortilla', 'Pasta']::text[], 'Sushi'),
    ('¿Cuál fue su primer viaje juntos?', '¿Cuál fue su primer viaje juntos?', 15, 'medium', ARRAY['París', 'Lisboa', 'Roma', 'Londres']::text[], 'Lisboa'),
    ('¿Quién tarda más en prepararse?', '¿Quién tarda más en prepararse?', 15, 'medium', ARRAY['La novia', 'El novio', 'Depende del día', 'Empate técnico']::text[], 'El novio'),
    ('¿Qué canción representa a la pareja?', '¿Qué canción representa a la pareja?', 15, 'medium', ARRAY['Su canción favorita', 'La del primer baile', 'Una de karaoke', 'Una de viaje']::text[], 'La del primer baile'),
    ('¿Qué mascota tendrían?', '¿Qué mascota tendrían?', 15, 'medium', ARRAY['Perro', 'Gato', 'Los dos', 'Ninguna']::text[], 'Perro'),
    ('¿Quién es más puntual?', '¿Quién es más puntual?', 15, 'medium', ARRAY['La novia', 'El novio', 'Los dos', 'Ninguno']::text[], 'La novia'),
    ('¿Cuál es su serie de sofá favorita?', '¿Cuál es su serie de sofá favorita?', 20, 'special', ARRAY['Friends', 'The Office', 'La que elijan juntos', 'Una de misterio']::text[], 'La que elijan juntos'),
    ('¿Quién organizó más detalles de la boda?', '¿Quién organizó más detalles de la boda?', 20, 'special', ARRAY['La novia', 'El novio', 'Ambos', 'La familia']::text[], 'Ambos'),
    ('¿Qué destino sueñan visitar?', '¿Qué destino sueñan visitar?', 20, 'special', ARRAY['Japón', 'Nueva York', 'Islandia', 'Grecia']::text[], 'Japón'),
    ('¿Cuál es el superpoder de la pareja?', '¿Cuál es el superpoder de la pareja?', 20, 'special', ARRAY['Reírse juntos', 'Bailar sin parar', 'Improvisar planes', 'Cocinar para todos']::text[], 'Reírse juntos'),
    ('¿Qué frase les define mejor?', '¿Qué frase les define mejor?', 20, 'special', ARRAY['Equipo siempre', 'Todo al último minuto', 'Planazo asegurado', 'Sí a todo']::text[], 'Equipo siempre')
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
  question_options,
  question_correct_option,
  is_active
)
SELECT
  title,
  description,
  'question',
  'Preguntas pareja',
  difficulty,
  default_points,
  true,
  45,
  question_options,
  question_correct_option,
  true
FROM question_challenges seed
WHERE NOT EXISTS (
  SELECT 1
  FROM public.captains_challenge_catalog existing
  WHERE lower(existing.title) = lower(seed.title)
);
