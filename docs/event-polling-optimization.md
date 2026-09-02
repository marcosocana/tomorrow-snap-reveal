# Event polling optimization

## Previous behavior

`Gallery.tsx` and `Camera.tsx` loaded the current row from `events` on mount and
again every 15 seconds while the tab was visible. The response included more
than 20 columns, including `password_hash`.

That refresh kept these values current:

- upload window start and end;
- reveal time and gallery/camera routing;
- gallery expiry and optional redirect;
- event name, description, images, fonts, header and demo state;
- upload, attachment, deletion, sharing and like-counting permissions;
- media limits and maximum recording durations;
- QR access protection settings and stored QR metadata.

At a steady five-minute observation window this produced 20 periodic requests,
plus the initial request (21 total event-config requests).

## Equivalent mechanism

`useLiveEventConfig` is now the shared event-config source for the camera and
gallery. It provides:

- one initial request with screen-specific columns;
- one local timeout for the nearest upload-start, upload-end, reveal or expiry
  transition, followed by exact revalidation;
- revalidation on focus, return to a visible tab and browser `online` recovery;
- one Realtime subscription filtered by `event_id`, removed on unmount;
- immediate screen-specific revalidation after each Realtime notification,
  without waiting for a 15-second interval.

Realtime uses `public_event_configs`, a trigger-maintained projection that has
no `password_hash`, `admin_password` or QR password hash. Event URL access and
QR password checks use security-definer RPCs and return no credential hash.

With no focus, reconnect, transition or backoffice update during the same
five-minute window, the new behavior is one initial config request and zero
periodic requests.
