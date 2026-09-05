-- A new, independent Capitanes game. Data only: no schema, RLS or existing-game changes.
-- Re-running is safe: all inserts use ON CONFLICT DO NOTHING and never reset progress.
BEGIN;

INSERT INTO public.captains_events (
  id,
  name,
  slug,
  description,
  start_time,
  end_time,
  scoring_mode,
  status,
  show_live_gallery_after_completion,
  public_url,
  qr_url,
  owner_id,
  theme_style,
  primary_color,
  secondary_color,
  background_image_url,
  contact_email
)
VALUES (
  'de100000-0000-4000-8000-000000000001',
  'Capitanes · Revelao',
  'demo-capitanes-v2',
  'Una mesa, un equipo y una celebración para recordar.',
  now(),
  '2099-12-31 23:59:59+00',
  'automatic',
  'active',
  true,
  '/capitanes/demo-capitanes-v2',
  '/capitanes/demo-capitanes-v2',
  (SELECT id FROM auth.users WHERE lower(email) = 'revelao.cam@gmail.com' LIMIT 1),
  'modern',
  '#f06a5f',
  '#2f292d',
  NULL,
  'revelao.cam@gmail.com'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.captains_tables (
  id,
  event_id,
  table_number,
  table_name,
  captain_name,
  active_captain_name,
  captain_sprite,
  captain_sprite_config,
  captain_photo_url,
  session_token,
  total_points,
  completed_challenges,
  failed_challenges
)
VALUES
  (
    'db100000-0000-4000-8000-000000000001',
    'de100000-0000-4000-8000-000000000001',
    1,
    'Mesa 1',
    'Jorge',
    'Jorge',
    'suit',
    '{"sex":"male","hair_length":"short","hair_color":"brown","skin_color":"fair","outfit_type":"suit","dress_color":"#202235","suit_color":"#1f2937","tie_color":"#f06a5f"}'::jsonb,
    (SELECT captain_photo_url FROM public.captains_tables WHERE id = 'db000000-0000-4000-8000-000000000001'),
    gen_random_uuid()::text,
    0,
    0,
    0
  ),
  (
    'db100000-0000-4000-8000-000000000002',
    'de100000-0000-4000-8000-000000000001',
    2,
    'Mesa 2',
    'Marta',
    'Marta',
    'dress',
    '{"sex":"female","hair_length":"long","hair_color":"brown","skin_color":"very_fair","outfit_type":"dress","dress_color":"#202235","suit_color":"#1f2937","tie_color":"#f06a5f"}'::jsonb,
    (SELECT captain_photo_url FROM public.captains_tables WHERE id = 'db000000-0000-4000-8000-000000000002'),
    gen_random_uuid()::text,
    0,
    0,
    0
  ),
  (
    'db100000-0000-4000-8000-000000000003',
    'de100000-0000-4000-8000-000000000001',
    3,
    'Mesa 3',
    'Laura',
    'Laura',
    'jacket',
    '{"sex":"female","hair_length":"short","hair_color":"dark","skin_color":"tan","outfit_type":"suit","dress_color":"#6fa341","suit_color":"#4f7f3a","tie_color":"#ffffff"}'::jsonb,
    (SELECT captain_photo_url FROM public.captains_tables WHERE id = 'db000000-0000-4000-8000-000000000003'),
    gen_random_uuid()::text,
    0,
    0,
    0
  ),
  (
    'db100000-0000-4000-8000-000000000004',
    'de100000-0000-4000-8000-000000000001',
    4,
    'Mesa 4',
    'Dani',
    'Dani',
    'festival',
    '{"sex":"male","hair_length":"short","hair_color":"dark","skin_color":"dark","outfit_type":"suit","dress_color":"#8a4f22","suit_color":"#8a4f22","tie_color":"#f8d24a"}'::jsonb,
    (SELECT captain_photo_url FROM public.captains_tables WHERE id = 'db000000-0000-4000-8000-000000000004'),
    gen_random_uuid()::text,
    0,
    0,
    0
  ),
  (
    'db100000-0000-4000-8000-000000000005',
    'de100000-0000-4000-8000-000000000001',
    5,
    'Mesa 5',
    NULL,
    NULL,
    'uniform',
    '{"sex":"female","hair_length":"long","hair_color":"blonde","skin_color":"fair","outfit_type":"dress","dress_color":"#d32027","suit_color":"#1f2937","tie_color":"#f06a5f"}'::jsonb,
    (SELECT captain_photo_url FROM public.captains_tables WHERE id = 'db000000-0000-4000-8000-000000000005'),
    gen_random_uuid()::text,
    0,
    0,
    0
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.captains_event_challenges (
  id,
  event_id,
  title,
  description,
  evidence_type,
  points,
  category,
  difficulty,
  has_time_limit,
  time_limit_seconds,
  question_correct_option,
  order_index,
  is_required
)
VALUES
  (
    'dc100000-0000-4000-8000-000000000001',
    'de100000-0000-4000-8000-000000000001',
    'Brindis de mesa',
    'Haced una foto de toda la mesa brindando por los novios.',
    'photo',
    20,
    'Mesa',
    'easy',
    false,
    NULL,
    NULL,
    1,
    true
  ),
  (
    'dc100000-0000-4000-8000-000000000002',
    'de100000-0000-4000-8000-000000000001',
    'Pregunta de pareja',
    '¿Dónde fue la primera cita de la pareja?',
    'question',
    15,
    'Pregunta',
    'medium',
    true,
    60,
    'En un restaurante',
    2,
    true
  ),
  (
    'dc100000-0000-4000-8000-000000000003',
    'de100000-0000-4000-8000-000000000001',
    'Mensaje secreto',
    'Grabad un vídeo corto dedicando un mensaje sorpresa a los novios.',
    'video',
    25,
    'Emotivo',
    'special',
    true,
    90,
    NULL,
    3,
    true
  ),
  (
    'dc100000-0000-4000-8000-000000000004',
    'de100000-0000-4000-8000-000000000001',
    'Aliados de otra mesa',
    'Haced una foto con alguien de otra mesa.',
    'photo',
    15,
    'Interacción',
    'medium',
    false,
    NULL,
    NULL,
    4,
    true
  ),
  (
    'dc100000-0000-4000-8000-000000000005',
    'de100000-0000-4000-8000-000000000001',
    'Coreografía exprés',
    'Grabad un vídeo corto con toda la mesa haciendo vuestra mejor coreografía.',
    'video',
    20,
    'Fiesta',
    'medium',
    true,
    90,
    NULL,
    5,
    true
  )
ON CONFLICT (id) DO NOTHING;


INSERT INTO public.captains_table_challenges (
  event_id,
  table_id,
  challenge_id,
  randomized_order_index,
  status
)
SELECT
  'de100000-0000-4000-8000-000000000001'::uuid,
  demo_table.id,
  demo_challenge.id,
  demo_challenge.order_index,
  CASE WHEN demo_challenge.order_index = 1 THEN 'ready' ELSE 'pending' END
FROM public.captains_tables demo_table
CROSS JOIN public.captains_event_challenges demo_challenge
WHERE demo_table.event_id = 'de100000-0000-4000-8000-000000000001'
  AND demo_challenge.event_id = 'de100000-0000-4000-8000-000000000001'
ON CONFLICT (table_id, challenge_id) DO NOTHING;


COMMIT;
