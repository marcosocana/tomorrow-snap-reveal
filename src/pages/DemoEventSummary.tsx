import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink, Download } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { enUS, es, it } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { QRCodeSVG } from "qrcode.react";
const demoLogoUrl = "/LogoTransparent.png";
import { PricingPreview } from "@/components/PricingPreview";
import { useDemoI18n } from "@/lib/demoI18n";

interface EventData {
  id: string;
  name: string;
  password_hash: string;
  admin_password: string;
  reveal_time: string;
  upload_start_time: string;
  upload_end_time: string;
  timezone: string;
  max_photos: number;
  max_videos?: number | null;
  max_audios?: number | null;
}

const DemoEventSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const { lang, t, pathPrefix } = useDemoI18n();

  const event = location.state?.event as EventData | undefined;
  const qrFromState = location.state?.qrUrl as string | undefined;
  const contactInfo = location.state?.contactInfo as
    | { email?: string; phone?: string }
    | undefined;

  // Redirect if no event data
  if (!event) {
    return <Navigate to={`${pathPrefix}/nuevoeventodemo`} replace />;
  }

  const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;
  const adminUrl = `https://acceso.revelao.cam${pathPrefix}/admin-login`;
  const eventTz = event.timezone || "Europe/Madrid";
  const shouldShowPricing = /^\d{8}$/.test(event.password_hash);
  const demoPhotos = event.max_photos ?? 10;
  const demoVideos = event.max_videos ?? 3;
  const demoAudios = event.max_audios ?? 6;
  const fallbackQrUrl = `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(
    eventUrl
  )}`;
  const qrImageUrl = qrFromState || fallbackQrUrl;

  const downloadQR = useCallback(async () => {
    if (!event) return;
    try {
      if (qrFromState) {
        const response = await fetch(qrFromState);
        if (!response.ok) throw new Error("QR_IMAGE_NOT_FOUND");
        const blob = await response.blob();
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = `qr-${event.name || "evento"}.png`;
        link.href = pngUrl;
        link.click();
        URL.revokeObjectURL(pngUrl);
        return;
      }

      const svg = qrRef.current?.querySelector("svg");
      if (!svg) throw new Error("QR_SVG_NOT_FOUND");
      const svgText = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();
      image.decoding = "async";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = svgUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 720;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("CANVAS_CONTEXT_NOT_FOUND");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(svgUrl);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("PNG_EXPORT_FAILED"))), "image/png");
      });
      const pngUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `qr-${event.name || "evento"}.png`;
      link.href = pngUrl;
      link.click();
      URL.revokeObjectURL(pngUrl);
    } catch {
      window.open(qrImageUrl, "_blank", "noopener,noreferrer");
    }
  }, [event, qrFromState, qrImageUrl]);

  useEffect(() => {
    if (!event || !contactInfo?.email || !qrImageUrl || isSendingEmail) return;
    const sentKey = `demo-email-sent-${event.id}`;
    if (localStorage.getItem(sentKey)) return;

    const timer = window.setTimeout(async () => {
      setIsSendingEmail(true);
      try {
        await supabase.functions.invoke("send-demo-event-email", {
          body: {
            event,
            qrUrl: qrImageUrl,
            contactInfo,
            eventType: "demo",
            planLabel: "Demo",
            lang,
          },
        });
        localStorage.setItem(sentKey, "1");
      } catch (error) {
        console.error("Error sending demo email:", error);
      } finally {
        setIsSendingEmail(false);
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [event, contactInfo, qrImageUrl, isSendingEmail]);


  const formatEventDate = (dateString: string) => {
    try {
      const date = toZonedTime(new Date(dateString), eventTz);
      if (lang === "es") {
        return format(date, "d 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
      }
      if (lang === "it") {
        return format(date, "d MMMM yyyy, HH:mm", { locale: it });
      }
      return format(date, "MMMM d, yyyy, HH:mm", { locale: enUS });
    } catch {
      return dateString;
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({
        title: t("summary.copyTitle"),
        description: t("summary.copyDesc"),
      });
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast({
        title: t("summary.copyErrorTitle"),
        description: t("summary.copyErrorDesc"),
        variant: "destructive",
      });
    }
  };

  const primaryButtonClass = "rounded-full bg-[#f06a5f] text-white hover:bg-[#f06a5f]/90";

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <img 
            src={demoLogoUrl} 
            alt="Revelao.com" 
            className="h-12 w-auto"
          />
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold">{t("summary.createdTitle")}</span>
          </div>
        </div>

        {/* Event Details Card */}
        <Card className="p-5 sm:p-6 space-y-6 rounded-lg shadow-sm">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{event.name}</h2>
            <p className="text-muted-foreground mt-1">
              {t("summary.demoLabel", { photos: demoPhotos, videos: demoVideos, audios: demoAudios })}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div ref={qrRef} className="bg-white p-4 rounded-lg shadow-sm">
              {qrFromState ? (
                <img
                  src={qrFromState}
                  alt={t("summary.qrAlt")}
                  className="h-[200px] w-[200px]"
                />
              ) : (
                <QRCodeSVG
                  value={eventUrl}
                  size={200}
                  level="H"
                  includeMargin
                />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadQR}
              className="gap-2 rounded-full"
            >
              <Download className="w-4 h-4" />
              {t("summary.qrDownload")}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              {t("summary.qrHint")}
            </p>
          </div>

          {/* Event Info */}
          <div className="space-y-4 border-t border-border pt-4">
            {/* Event URL */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{t("summary.eventUrl")}</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm break-all">
                  {eventUrl}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  className="rounded-full"
                  onClick={() => copyToClipboard(eventUrl, 'url')}
                >
                  {copiedField === 'url' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Dates */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">{t("summary.uploadStart")}</label>
                <p className="text-sm">{formatEventDate(event.upload_start_time)}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">{t("summary.uploadEnd")}</label>
                <p className="text-sm">{formatEventDate(event.upload_end_time)}</p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">{t("summary.revealDate")}</label>
              <p className="text-sm">{formatEventDate(event.reveal_time)}</p>
            </div>
          </div>
        </Card>

        {/* Admin Access Instructions */}
        <Card className="p-5 sm:p-6 border-[#f06a5f]/30 bg-[#f06a5f]/5 rounded-lg">
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Entra en{" "}
              <a
                href={adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                acceso.revelao.cam
              </a>{" "}
              o accede a través del siguiente botón.
            </p>
            <Button
              className={primaryButtonClass}
              asChild
            >
              <a href={adminUrl} target="_blank" rel="noopener noreferrer">
                Gestionar evento
              </a>
            </Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6 border-[#f06a5f]/30 bg-[#f06a5f]/5 rounded-lg">
          <h3 className="font-semibold text-foreground mb-2">{t("summary.demoNoticeTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("summary.demoNoticeText")}{" "}
            <a
              href="https://www.revelao.cam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f06a5f] hover:underline font-medium"
            >
              revelao.cam
            </a>{" "}
            {t("summary.demoNoticeTextEnd")}
          </p>
        </Card>

        {shouldShowPricing ? (
          <Card className="p-5 sm:p-6 rounded-lg">
            <PricingPreview />
          </Card>
        ) : null}

        {/* Help */}
        <p className="text-center text-sm text-muted-foreground">
          {t("summary.help")}{" "}
          <a
            href="https://wa.me/34695834018?text=Hola%2C%20acabo%20de%20crear%20un%20evento%20de%20prueba%20y%20tengo%20una%20duda."
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#f06a5f] hover:underline font-semibold"
          >
            {t("summary.contact")}
          </a>
        </p>
      </div>
    </div>
  );
};

export default DemoEventSummary;
