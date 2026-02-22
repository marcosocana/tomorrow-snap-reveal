import { useLocation, useNavigate, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, ExternalLink, Download } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { enUS, es, it } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import logoRevelao from "@/assets/logo-revelao.png";
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
}

const DemoEventSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
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
  const storedQrUrl = event
    ? localStorage.getItem(`event-qr-url-${event.id}`) ||
      supabase.storage
        .from("event-photos")
        .getPublicUrl(`event-qr/qr-${event.id}.png`).data.publicUrl
    : "";
  const fallbackQrUrl = `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(
    eventUrl
  )}`;
  const qrImageUrl = qrFromState || storedQrUrl || fallbackQrUrl;

  const downloadQR = useCallback(async () => {
    if (!event) return;
    const qrImageUrl =
      qrFromState ||
      storedQrUrl ||
      `https://quickchart.io/qr?size=220&margin=1&ecLevel=H&text=${encodeURIComponent(
        `https://acceso.revelao.cam/events/${event.password_hash}`
      )}`;

    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `qr-${event.name || "evento"}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(qrImageUrl, "_blank", "noopener,noreferrer");
    }
  }, [event, qrFromState, storedQrUrl]);

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

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <img 
            src={logoRevelao} 
            alt="Revelao.com" 
            className="w-48 h-auto"
          />
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <span className="text-xl font-semibold">{t("summary.createdTitle")}</span>
          </div>
        </div>

        {/* Event Details Card */}
        <Card className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground">{event.name}</h2>
            <p className="text-muted-foreground mt-1">
              {t("summary.demoLabel", { count: event.max_photos })}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <img
                src={qrImageUrl}
                alt={t("summary.qrAlt")}
                className="w-[200px] h-[200px]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadQR}
              className="gap-2"
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
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm break-all">
                  {eventUrl}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
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
        <Card className="p-6 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <span className="text-lg">🔐</span>
            {t("summary.adminTitle")}
          </h3>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {t("summary.adminStepIntro")}
            </p>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                {t("summary.adminStep1")}{" "}
                <a 
                  href={adminUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                >
                  acceso.revelao.cam
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                {t("summary.adminStep2")}{" "}
                <code className="bg-background px-1 rounded">{event.admin_password}</code>
              </li>
              <li>{t("summary.adminStep3")}</li>
            </ol>
          </div>
        </Card>

        <Card className="p-6 border-primary/30 bg-primary/5">
          <h3 className="font-semibold text-foreground mb-2">{t("summary.demoNoticeTitle")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("summary.demoNoticeText")}{" "}
            <a
              href="https://www.revelao.cam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              revelao.cam
            </a>{" "}
            {t("summary.demoNoticeTextEnd")}
          </p>
        </Card>

        {shouldShowPricing ? (
          <Card className="p-6">
            <PricingPreview />
          </Card>
        ) : null}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => navigate(`${pathPrefix}/nuevoeventodemo`)}
          >
            {t("summary.createAnother")}
          </Button>
          <Button 
            className="flex-1"
            onClick={() => window.open(eventUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            {t("summary.goToEvent")}
          </Button>
        </div>

        {/* Help */}
        <p className="text-center text-sm text-muted-foreground">
          {t("summary.help")}{" "}
          <a
            href="https://wa.me/34695834018?text=Hola%2C%20acabo%20de%20crear%20un%20evento%20de%20prueba%20y%20tengo%20una%20duda."
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-semibold"
          >
            {t("summary.contact")}
          </a>
        </p>
      </div>
    </div>
  );
};

export default DemoEventSummary;
