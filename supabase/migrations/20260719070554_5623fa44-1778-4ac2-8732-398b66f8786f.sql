-- 20260719160000_store_captains_question_answers.sql
ALTER TABLE public.captains_table_challenges
  ADD COLUMN IF NOT EXISTS question_answer text;

COMMENT ON COLUMN public.captains_table_challenges.question_answer IS
  'Answer selected by the table when completing a question challenge.';

-- 20260719150000_seed_editable_captains_demo.sql
INSERT INTO public.captains_events (
  id, name, slug, description, start_time, end_time, scoring_mode, status,
  show_live_gallery_after_completion, public_url, qr_url, owner_id,
  theme_style, primary_color, secondary_color, background_image_url, contact_email
) VALUES (
  'de000000-0000-4000-8000-000000000001',
  'Demo Capitanes by Revelao',
  'demo-capitanes',
  'Una partida de prueba para ver la experiencia pública: mesas, retos, puntos, ranking y recuerdos en directo.',
  now(),
  '2099-12-31 23:59:59+00',
  'automatic',
  'active',
  true,
  '/capitanes/demo-capitanes',
  '/capitanes/demo-capitanes',
  (SELECT id FROM auth.users WHERE lower(email) = 'revelao.cam@gmail.com' LIMIT 1),
  'pixel',
  '#f06a5f',
  '#2f292d',
  NULL,
  'revelao.cam@gmail.com'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.captains_tables (
  id, event_id, table_number, table_name, captain_name, active_captain_name,
  captain_sprite, captain_sprite_config, session_token, total_points,
  completed_challenges, failed_challenges
) VALUES
  ('db000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000001',1,'Mesa 1','Jorge','Jorge','suit','{"sex":"male","hair_length":"short","hair_color":"brown","skin_color":"fair","outfit_type":"suit","dress_color":"#202235","suit_color":"#1f2937","tie_color":"#f06a5f"}'::jsonb,'demo-session-1',35,2,0),
  ('db000000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000001',2,'Mesa 2','Marta','Marta','dress','{"sex":"female","hair_length":"long","hair_color":"brown","skin_color":"very_fair","outfit_type":"dress","dress_color":"#202235","suit_color":"#1f2937","tie_color":"#f06a5f"}'::jsonb,'demo-session-2',22,1,1),
  ('db000000-0000-4000-8000-000000000003','de000000-0000-4000-8000-000000000001',3,'Mesa 3','Laura','Laura','jacket','{"sex":"female","hair_length":"short","hair_color":"dark","skin_color":"tan","outfit_type":"suit","dress_color":"#6fa341","suit_color":"#4f7f3a","tie_color":"#ffffff"}'::jsonb,'demo-session-3',16,1,0),
  ('db000000-0000-4000-8000-000000000004','de000000-0000-4000-8000-000000000001',4,'Mesa 4','Dani','Dani','festival','{"sex":"male","hair_length":"short","hair_color":"dark","skin_color":"dark","outfit_type":"suit","dress_color":"#8a4f22","suit_color":"#8a4f22","tie_color":"#f8d24a"}'::jsonb,'demo-session-4',0,0,0),
  ('db000000-0000-4000-8000-000000000005','de000000-0000-4000-8000-000000000001',5,'Mesa 5',NULL,NULL,'uniform','{"sex":"female","hair_length":"long","hair_color":"blonde","skin_color":"fair","outfit_type":"dress","dress_color":"#d32027","suit_color":"#1f2937","tie_color":"#f06a5f"}'::jsonb,'demo-session-5',0,0,0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.captains_event_challenges (
  id, event_id, title, description, evidence_type, points, category, difficulty,
  has_time_limit, time_limit_seconds, question_correct_option, order_index, is_required
) VALUES
  ('dc000000-0000-4000-8000-000000000001','de000000-0000-4000-8000-000000000001','Brindis de mesa','Haced una foto de toda la mesa brindando por los novios.','photo',20,'Mesa','easy',false,NULL,NULL,1,true),
  ('dc000000-0000-4000-8000-000000000002','de000000-0000-4000-8000-000000000001','Pregunta de pareja','¿Dónde fue la primera cita de la pareja?','question',15,'Pregunta','medium',true,60,'En un restaurante',2,true),
  ('dc000000-0000-4000-8000-000000000003','de000000-0000-4000-8000-000000000001','Mensaje secreto','Grabad un vídeo corto dedicando un mensaje sorpresa a los novios.','video',25,'Emotivo','special',true,90,NULL,3,true),
  ('dc000000-0000-4000-8000-000000000004','de000000-0000-4000-8000-000000000001','Aliados de otra mesa','Haced una foto con alguien de otra mesa.','photo',15,'Interacción','medium',false,NULL,NULL,4,true),
  ('dc000000-0000-4000-8000-000000000005','de000000-0000-4000-8000-000000000001','Coreografía exprés','Grabad un vídeo corto con toda la mesa haciendo vuestra mejor coreografía.','video',20,'Fiesta','medium',true,90,NULL,5,true)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  options_type text;
BEGIN
  SELECT data_type INTO options_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='captains_event_challenges' AND column_name='question_options';
  IF options_type = 'jsonb' THEN
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = '["En un restaurante","En la playa","En un concierto","En casa de amigos"]'::jsonb WHERE id = 'dc000000-0000-4000-8000-000000000002'$sql$;
  ELSE
    EXECUTE $sql$UPDATE public.captains_event_challenges SET question_options = ARRAY['En un restaurante','En la playa','En un concierto','En casa de amigos']::text[] WHERE id = 'dc000000-0000-4000-8000-000000000002'$sql$;
  END IF;
END;
$$;

INSERT INTO public.captains_table_challenges (event_id, table_id, challenge_id, randomized_order_index, status)
SELECT
  'de000000-0000-4000-8000-000000000001'::uuid, demo_table.id, demo_challenge.id, demo_challenge.order_index,
  CASE WHEN demo_challenge.order_index = 1 THEN 'ready' ELSE 'pending' END
FROM public.captains_tables demo_table
CROSS JOIN public.captains_event_challenges demo_challenge
WHERE demo_table.event_id = 'de000000-0000-4000-8000-000000000001'
  AND demo_challenge.event_id = 'de000000-0000-4000-8000-000000000001'
ON CONFLICT (table_id, challenge_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.protect_captains_demo_from_non_admin_changes()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  affected_event_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'captains_events' THEN
    IF TG_OP = 'DELETE' THEN
      affected_event_id := NULLIF(to_jsonb(OLD) ->> 'id', '')::uuid;
    ELSE
      affected_event_id := NULLIF(to_jsonb(NEW) ->> 'id', '')::uuid;
    END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN
      affected_event_id := NULLIF(to_jsonb(OLD) ->> 'event_id', '')::uuid;
    ELSE
      affected_event_id := NULLIF(to_jsonb(NEW) ->> 'event_id', '')::uuid;
    END IF;
  END IF;

  IF affected_event_id = 'de000000-0000-4000-8000-000000000001'::uuid
    AND COALESCE(auth.role(), '') <> 'service_role'
    AND lower(COALESCE(auth.jwt() ->> 'email', '')) <> 'revelao.cam@gmail.com'
  THEN
    RAISE EXCEPTION 'Only revelao.cam@gmail.com can modify the Captains demo.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_captains_demo_event ON public.captains_events;
CREATE TRIGGER protect_captains_demo_event BEFORE UPDATE OR DELETE ON public.captains_events
FOR EACH ROW EXECUTE FUNCTION public.protect_captains_demo_from_non_admin_changes();

DROP TRIGGER IF EXISTS protect_captains_demo_tables ON public.captains_tables;
CREATE TRIGGER protect_captains_demo_tables BEFORE INSERT OR UPDATE OR DELETE ON public.captains_tables
FOR EACH ROW EXECUTE FUNCTION public.protect_captains_demo_from_non_admin_changes();

DROP TRIGGER IF EXISTS protect_captains_demo_challenges ON public.captains_event_challenges;
CREATE TRIGGER protect_captains_demo_challenges BEFORE INSERT OR UPDATE OR DELETE ON public.captains_event_challenges
FOR EACH ROW EXECUTE FUNCTION public.protect_captains_demo_from_non_admin_changes();

DROP TRIGGER IF EXISTS protect_captains_demo_progress ON public.captains_table_challenges;
CREATE TRIGGER protect_captains_demo_progress BEFORE INSERT OR UPDATE OR DELETE ON public.captains_table_challenges
FOR EACH ROW EXECUTE FUNCTION public.protect_captains_demo_from_non_admin_changes();

DROP TRIGGER IF EXISTS protect_captains_demo_evidence ON public.captains_evidence;
CREATE TRIGGER protect_captains_demo_evidence BEFORE INSERT OR UPDATE OR DELETE ON public.captains_evidence
FOR EACH ROW EXECUTE FUNCTION public.protect_captains_demo_from_non_admin_changes();

NOTIFY pgrst, 'reload schema';