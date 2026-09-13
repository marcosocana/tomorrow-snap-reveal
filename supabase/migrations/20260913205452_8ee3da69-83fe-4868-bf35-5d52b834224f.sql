ALTER TABLE public.purchase_email_outbox
  DROP CONSTRAINT IF EXISTS purchase_email_outbox_email_type_check;

ALTER TABLE public.purchase_email_outbox
  ADD CONSTRAINT purchase_email_outbox_email_type_check
  CHECK (
    email_type IN (
      'revelao_purchase',
      'captains_purchase',
      'photostrip_purchase'
    )
  );