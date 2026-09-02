import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type LiveEventConfig = {
  event_id: string;
  name: string;
  reveal_time: string;
  hide_reveal_date: boolean;
  upload_start_time: string | null;
  upload_end_time: string | null;
  expiry_date: string | null;
  expiry_redirect_url: string | null;
  filter_type: string;
  custom_image_url: string | null;
  background_image_url: string | null;
  description: string | null;
  font_family: string;
  font_size: string;
  show_legal_text: boolean;
  legal_text_type: string;
  allow_photo_deletion: boolean;
  allow_photo_sharing: boolean;
  like_counting_enabled: boolean;
  allow_video_recording: boolean;
  max_videos: number;
  max_video_duration: number;
  allow_audio_recording: boolean;
  max_audios: number;
  max_audio_duration: number;
  allow_image_attachment: boolean;
  allow_video_attachment: boolean;
  max_photos: number | null;
  header_style: string;
  is_demo: boolean;
  limits_json: unknown;
  qr_password_required_camera: boolean;
  qr_password_required_gallery: boolean;
  updated_at: string;
};

const EVENT_CONFIG_COLUMNS = {
  camera: [
    "event_id", "name", "reveal_time", "hide_reveal_date", "upload_start_time",
    "upload_end_time", "custom_image_url", "background_image_url", "description",
    "font_family", "font_size", "allow_video_recording", "max_videos",
    "max_video_duration", "allow_audio_recording", "allow_image_attachment",
    "allow_video_attachment", "max_photos", "header_style", "is_demo", "limits_json",
    "show_legal_text", "legal_text_type", "max_audios", "max_audio_duration",
  ].join(","),
  gallery: [
    "event_id", "name", "reveal_time", "custom_image_url", "background_image_url",
    "description", "font_family", "font_size", "allow_video_recording",
    "max_video_duration", "allow_audio_recording", "allow_image_attachment",
    "allow_video_attachment", "header_style", "is_demo", "limits_json",
    "expiry_date", "expiry_redirect_url", "filter_type", "allow_photo_deletion",
    "allow_photo_sharing", "like_counting_enabled", "qr_password_required_gallery",
  ].join(","),
} as const;

const MAX_TIMEOUT_MS = 2_147_000_000;

export const useLiveEventConfig = (eventId: string | null, scope: keyof typeof EVENT_CONFIG_COLUMNS) => {
  const [config, setConfig] = useState<LiveEventConfig | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [transitionRevision, setTransitionRevision] = useState(0);
  const requestRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (!eventId) {
      setIsReady(true);
      return Promise.resolve();
    }
    if (requestRef.current) return requestRef.current;

    const request = (async () => {
      try {
        const { data, error } = await supabase
          .from("public_event_configs" as never)
          .select(EVENT_CONFIG_COLUMNS[scope])
          .eq("event_id", eventId)
          .maybeSingle();
        if (error) throw error;
        if (data) setConfig(data as unknown as LiveEventConfig);
      } catch (error) {
        console.error("Error loading public event configuration:", error);
      } finally {
        setIsReady(true);
        requestRef.current = null;
      }
    })();
    requestRef.current = request;
    return request;
  }, [eventId, scope]);

  useEffect(() => {
    setConfig(null);
    setIsReady(false);
    void refresh();
  }, [eventId, refresh]);

  useEffect(() => {
    if (!eventId) return;
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("online", refresh);
    };
  }, [eventId, refresh]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`public-event-config-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "public_event_configs",
          filter: `event_id=eq.${eventId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, refresh]);

  useEffect(() => {
    if (!config) return;
    const now = Date.now();
    const nextTransition = [
      config.upload_start_time,
      config.upload_end_time,
      config.reveal_time,
      config.expiry_date,
    ]
      .map((value) => value ? new Date(value).getTime() : Number.NaN)
      .filter((value) => Number.isFinite(value) && value > now)
      .sort((a, b) => a - b)[0];
    if (!nextTransition) return;

    const delay = Math.min(Math.max(0, nextTransition - now), MAX_TIMEOUT_MS);
    const timer = window.setTimeout(() => {
      if (delay < MAX_TIMEOUT_MS) setTransitionRevision((value) => value + 1);
      void refresh();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [config, refresh, transitionRevision]);

  return { config, isReady, refresh, transitionRevision };
};
