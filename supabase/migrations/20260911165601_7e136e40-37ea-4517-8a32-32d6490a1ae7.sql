-- Create the editable v2 demo as a fresh copy of the current test wedding.
BEGIN;

DELETE FROM public.captains_events
WHERE slug = 'demo-capitanes-v2';

DO $$
DECLARE
  source_event public.captains_events%ROWTYPE;
  demo_event_id uuid := 'de100000-0000-4000-8000-000000000001'::uuid;
  demo_owner_id uuid;
BEGIN
  SELECT * INTO source_event
  FROM public.captains_events
  WHERE slug = 'boda-de-pruebita-y-pruebito'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot create Evento Demo v2: source event boda-de-pruebita-y-pruebito was not found';
  END IF;

  SELECT id INTO demo_owner_id
  FROM auth.users
  WHERE lower(email) = 'revelao.cam@gmail.com'
  LIMIT 1;

  INSERT INTO public.captains_events (
    id, name, slug, description, start_time, end_time, scoring_mode, status,
    show_live_gallery_after_completion, public_url, qr_url, owner_id,
    primary_color, secondary_color, background_image_url, theme_style,
    contact_name, contact_email, contact_phone, admin_event_tab,
    experience_version, wedding_context, character_1_config,
    character_2_config, host_characters_enabled, host_tone, host_frequency
  )
  VALUES (
    demo_event_id, 'Evento Demo v2', 'demo-capitanes-v2', source_event.description,
    now(), '2099-12-31 23:59:59+00', source_event.scoring_mode, 'active',
    source_event.show_live_gallery_after_completion,
    '/capitanes/demo-capitanes-v2', '/capitanes/demo-capitanes-v2',
    COALESCE(demo_owner_id, source_event.owner_id), source_event.primary_color,
    source_event.secondary_color, source_event.background_image_url,
    source_event.theme_style, source_event.contact_name, source_event.contact_email,
    source_event.contact_phone, 'tests', 'v2', source_event.wedding_context,
    source_event.character_1_config, source_event.character_2_config,
    source_event.host_characters_enabled, source_event.host_tone,
    source_event.host_frequency
  );

  INSERT INTO public.captains_tables (
    event_id, table_number, table_name, captain_name, active_captain_name,
    captain_photo_url, captain_sprite, captain_sprite_config,
    total_points, completed_challenges, failed_challenges
  )
  SELECT
    demo_event_id, source_table.table_number, source_table.table_name,
    source_table.captain_name, source_table.active_captain_name,
    source_table.captain_photo_url, source_table.captain_sprite,
    source_table.captain_sprite_config, 0, 0, 0
  FROM public.captains_tables source_table
  WHERE source_table.event_id = source_event.id
  ORDER BY source_table.table_number;

  INSERT INTO public.captains_event_challenges (
    event_id, catalog_challenge_id, title, description, evidence_type,
    points, category, difficulty, has_time_limit, time_limit_seconds,
    question_options, question_correct_option, order_index, is_required
  )
  SELECT
    demo_event_id, source_challenge.catalog_challenge_id, source_challenge.title,
    source_challenge.description, source_challenge.evidence_type,
    source_challenge.points, source_challenge.category, source_challenge.difficulty,
    source_challenge.has_time_limit, source_challenge.time_limit_seconds,
    source_challenge.question_options, source_challenge.question_correct_option,
    source_challenge.order_index, source_challenge.is_required
  FROM public.captains_event_challenges source_challenge
  WHERE source_challenge.event_id = source_event.id
  ORDER BY source_challenge.order_index;

  INSERT INTO public.captains_table_challenges (
    event_id, table_id, challenge_id, randomized_order_index, status
  )
  SELECT
    demo_event_id, demo_table.id, demo_challenge.id, demo_challenge.order_index,
    CASE WHEN demo_challenge.order_index = first_challenge.first_order_index
      THEN 'ready' ELSE 'pending' END
  FROM public.captains_tables demo_table
  CROSS JOIN public.captains_event_challenges demo_challenge
  CROSS JOIN (
    SELECT min(order_index) AS first_order_index
    FROM public.captains_event_challenges
    WHERE event_id = demo_event_id
  ) first_challenge
  WHERE demo_table.event_id = demo_event_id
    AND demo_challenge.event_id = demo_event_id;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';