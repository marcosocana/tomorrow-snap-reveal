-- Replace the shared v2 demo with a fresh 15-challenge wedding.
BEGIN;

DELETE FROM public.captains_events
WHERE slug = 'demo-capitanes-v2';

INSERT INTO public.captains_events (
  id, name, slug, description, start_time, end_time, scoring_mode, status,
  show_live_gallery_after_completion, public_url, qr_url, owner_id,
  theme_style, experience_version, primary_color, secondary_color,
  background_image_url, contact_email, wedding_context,
  character_1_config, character_2_config, host_characters_enabled,
  host_tone, host_frequency
)
VALUES (
  'de100000-0000-4000-8000-000000000001',
  'Boda de María y Marcos',
  'demo-capitanes-v2',
  'Quince retos para celebrar, competir y guardar los mejores momentos de la boda.',
  now(),
  '2099-12-31 23:59:59+00',
  'automatic',
  'active',
  true,
  '/capitanes/demo-capitanes-v2',
  '/capitanes/demo-capitanes-v2',
  (SELECT id FROM auth.users WHERE lower(email) = 'revelao.cam@gmail.com' LIMIT 1),
  'modern',
  'v2',
  '#f06a5f',
  '#2f292d',
  NULL,
  'revelao.cam@gmail.com',
  '{"partner_1_name":"Marcos","partner_1_nickname":"Marcos","partner_2_name":"María","partner_2_nickname":"María","years_together":7,"relationship_start_date":"","venue_name":"Finca Revelao","venue_city":"Madrid","venue_region":"Madrid","venue_country":"España","venue_address":"","how_they_met":"A través de amigos","met_location":"Madrid","city_where_they_live":"Madrid","shared_hobby":"viajar","special_song":"","inside_phrase":"","most_competitive_partner":"María","fun_fact":""}'::jsonb,
  '{"linked_partner":"partner_1","display_name":"Marcos","skin_tone":"medium","hair_style":"short","hair_color":"dark","facial_hair":"stubble","glasses":"none","head_accessory":"none","outfit":"classic_suit","primary_color":"#26354a","secondary_color":"#fff6ec","accessory":"tie","sprite_config":{"sex":"male","hair_length":"short","hair_color":"dark","skin_color":"fair","outfit_type":"tuxedo","dress_color":"#fffaf4","suit_color":"#20212a","tie_color":"#15151c"}}'::jsonb,
  '{"linked_partner":"partner_2","display_name":"María","skin_tone":"light","hair_style":"long","hair_color":"brown","facial_hair":"none","glasses":"none","head_accessory":"none","outfit":"modern_dress","primary_color":"#f06a5f","secondary_color":"#fff6ec","accessory":"bouquet","sprite_config":{"sex":"female","hair_length":"bun","hair_color":"brown","skin_color":"very_fair","outfit_type":"wedding_dress","dress_color":"#fffaf4","suit_color":"#20212a","tie_color":"#15151c"}}'::jsonb,
  true,
  'divertido',
  'high'
);

INSERT INTO public.captains_tables (
  id, event_id, table_number, table_name, captain_name, active_captain_name,
  captain_sprite, captain_sprite_config, captain_photo_url, session_token,
  total_points, completed_challenges, failed_challenges
)
VALUES
  ('db200000-0000-4000-8000-000000000001','de100000-0000-4000-8000-000000000001',1,'Los de siempre','Alicia','Alicia','dress','{"sex":"female","hair_length":"long","hair_color":"brown","skin_color":"fair","outfit_type":"dress","dress_color":"#d32027","suit_color":"#1f2937","tie_color":"#ffffff"}'::jsonb,NULL,'demo-maria-marcos-1',0,0,0),
  ('db200000-0000-4000-8000-000000000002','de100000-0000-4000-8000-000000000001',2,'Equipo Vermú','Pablo','Pablo','suit','{"sex":"male","hair_length":"short","hair_color":"dark","skin_color":"fair","outfit_type":"suit","dress_color":"#202235","suit_color":"#1f2937","tie_color":"#f06a5f"}'::jsonb,NULL,'demo-maria-marcos-2',0,0,0),
  ('db200000-0000-4000-8000-000000000003','de100000-0000-4000-8000-000000000001',3,'La familia','Lucía','Lucía','dress','{"sex":"female","hair_length":"long","hair_color":"blonde","skin_color":"very_fair","outfit_type":"long_dress","dress_color":"#7656a8","suit_color":"#1f2937","tie_color":"#ffffff"}'::jsonb,NULL,'demo-maria-marcos-3',0,0,0),
  ('db200000-0000-4000-8000-000000000004','de100000-0000-4000-8000-000000000001',4,'Amigos del norte','Dani','Dani','jacket','{"sex":"male","hair_length":"short","hair_color":"brown","skin_color":"tan","outfit_type":"shirt","dress_color":"#4f7f3a","suit_color":"#4f7f3a","tie_color":"#ffffff"}'::jsonb,NULL,'demo-maria-marcos-4',0,0,0),
  ('db200000-0000-4000-8000-000000000005','de100000-0000-4000-8000-000000000001',5,'Los últimos en irse','Sara','Sara','festival','{"sex":"female","hair_length":"curly","hair_color":"dark","skin_color":"dark","outfit_type":"jumpsuit","dress_color":"#e6bd68","suit_color":"#8a4f22","tie_color":"#ffffff"}'::jsonb,NULL,'demo-maria-marcos-5',0,0,0);

INSERT INTO public.captains_event_challenges (
  id, event_id, title, description, evidence_type, points, category,
  difficulty, has_time_limit, time_limit_seconds, question_correct_option,
  order_index, is_required
)
VALUES
  ('dc200000-0000-4000-8000-000000000001','de100000-0000-4000-8000-000000000001','Selfie de bienvenida','Haced una selfie con toda la mesa para inaugurar el juego.','photo',10,'Bienvenida','easy',false,NULL,NULL,1,true),
  ('dc200000-0000-4000-8000-000000000002','de100000-0000-4000-8000-000000000001','¿En qué ciudad se conocieron María y Marcos?','','question',15,'La pareja','medium',false,NULL,'Madrid',2,true),
  ('dc200000-0000-4000-8000-000000000003','de100000-0000-4000-8000-000000000001','Grito de guerra','Grabad el nombre de vuestra mesa y vuestro mejor grito de guerra.','video',15,'Equipo','easy',true,30,NULL,3,true),
  ('dc200000-0000-4000-8000-000000000004','de100000-0000-4000-8000-000000000001','Brindis de mesa','Haced una foto de toda la mesa brindando por María y Marcos.','photo',10,'Mesa','easy',false,NULL,NULL,4,true),
  ('dc200000-0000-4000-8000-000000000005','de100000-0000-4000-8000-000000000001','Aliados de otra mesa','Haced una foto con invitados de una mesa diferente.','photo',15,'Interacción','medium',false,NULL,NULL,5,true),
  ('dc200000-0000-4000-8000-000000000006','de100000-0000-4000-8000-000000000001','Dedicatoria en tres palabras','Resumid a la pareja en tres palabras y grabad vuestra dedicatoria.','video',20,'Emotivo','medium',true,30,NULL,6,true),
  ('dc200000-0000-4000-8000-000000000007','de100000-0000-4000-8000-000000000001','¿Quién dio el primer paso?','','question',15,'La pareja','medium',false,NULL,'Marcos',7,true),
  ('dc200000-0000-4000-8000-000000000008','de100000-0000-4000-8000-000000000001','Pose de portada','Haced una foto de vuestra mesa como si protagonizase la portada de una revista.','photo',15,'Creatividad','medium',false,NULL,NULL,8,true),
  ('dc200000-0000-4000-8000-000000000009','de100000-0000-4000-8000-000000000001','Coreografía relámpago','Grabad un baile sincronizado con toda la mesa.','video',20,'Fiesta','medium',true,30,NULL,9,true),
  ('dc200000-0000-4000-8000-000000000010','de100000-0000-4000-8000-000000000001','¿Cuál es el viaje soñado de la pareja?','','question',15,'La pareja','medium',false,NULL,'Japón',10,true),
  ('dc200000-0000-4000-8000-000000000011','de100000-0000-4000-8000-000000000001','Recread a los novios','Imitad una pose romántica de María y Marcos en una foto de grupo.','photo',20,'Creatividad','hard',false,NULL,NULL,11,true),
  ('dc200000-0000-4000-8000-000000000012','de100000-0000-4000-8000-000000000001','Consejo para el futuro','Grabad el mejor consejo de vuestra mesa para la vida de casados.','video',20,'Emotivo','medium',true,30,NULL,12,true),
  ('dc200000-0000-4000-8000-000000000013','de100000-0000-4000-8000-000000000001','¿Quién tarda más en prepararse?','','question',15,'La pareja','easy',false,NULL,'María',13,true),
  ('dc200000-0000-4000-8000-000000000014','de100000-0000-4000-8000-000000000001','La pista es vuestra','Haced una foto de vuestra mesa dándolo todo en la pista de baile.','photo',15,'Fiesta','medium',false,NULL,NULL,14,true),
  ('dc200000-0000-4000-8000-000000000015','de100000-0000-4000-8000-000000000001','El gran final','Grabad un mensaje conjunto para que María y Marcos lo descubran después de la boda.','video',25,'Final','special',true,30,NULL,15,true);

DO $$
DECLARE
  options_type text;
BEGIN
  SELECT data_type INTO options_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'captains_event_challenges'
    AND column_name = 'question_options';

  IF options_type = 'jsonb' THEN
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = '["Madrid","Valencia","Sevilla","Barcelona"]'::jsonb WHERE id = 'dc200000-0000-4000-8000-000000000002'$sql$;
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = '["María","Marcos","Los dos a la vez","Ninguno"]'::jsonb WHERE id = 'dc200000-0000-4000-8000-000000000007'$sql$;
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = '["Japón","Islandia","Nueva York","Costa Rica"]'::jsonb WHERE id = 'dc200000-0000-4000-8000-000000000010'$sql$;
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = '["María","Marcos","Depende del día","Empate"]'::jsonb WHERE id = 'dc200000-0000-4000-8000-000000000013'$sql$;
  ELSE
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = ARRAY['Madrid','Valencia','Sevilla','Barcelona']::text[] WHERE id = 'dc200000-0000-4000-8000-000000000002'$sql$;
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = ARRAY['María','Marcos','Los dos a la vez','Ninguno']::text[] WHERE id = 'dc200000-0000-4000-8000-000000000007'$sql$;
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = ARRAY['Japón','Islandia','Nueva York','Costa Rica']::text[] WHERE id = 'dc200000-0000-4000-8000-000000000010'$sql$;
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = ARRAY['María','Marcos','Depende del día','Empate']::text[] WHERE id = 'dc200000-0000-4000-8000-000000000013'$sql$;
  END IF;
END;
$$;

INSERT INTO public.captains_table_challenges (
  event_id, table_id, challenge_id, randomized_order_index, status
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
  AND demo_challenge.event_id = 'de100000-0000-4000-8000-000000000001';

COMMIT;

NOTIFY pgrst, 'reload schema';
