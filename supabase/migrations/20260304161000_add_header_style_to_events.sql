alter table public.events
add column if not exists header_style text not null default 'modern';

comment on column public.events.header_style is 'Header style for camera and gallery screens: gradient | modern';
