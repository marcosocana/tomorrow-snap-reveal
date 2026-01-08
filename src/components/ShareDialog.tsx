import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Language } from "@/lib/translations";

interface ShareDialogProps {
  eventPassword: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRevealed?: boolean;
  language?: Language;
}

const ShareDialog = ({ eventPassword, eventName, open, onOpenChange, isRevealed = false, language = "es" }: ShareDialogProps) => {
  const { toast } = useToast();
  const eventUrl = `https://acceso.revelao.cam/events/${eventPassword}`;

  // Translations
  const texts = {
    es: {
      title: "Compartir evento",
      description: "Comparte este QR o URL para que otros puedan unirse al evento",
      urlLabel: "URL del evento:",
      copied: "URL copiada",
      copiedDesc: "La URL del evento se ha copiado al portapapeles",
      shareButton: "Compartir evento",
      shareTextRevealed: `Ya se han revelado las fotos del evento "${eventName}". Accede a través de:`,
      shareTextActive: `¡Únete al evento "${eventName}" en Revelao! 📸`,
      textCopied: "Texto copiado",
      textCopiedDesc: "El mensaje se ha copiado al portapapeles",
    },
    en: {
      title: "Share event",
      description: "Share this QR or URL so others can join the event",
      urlLabel: "Event URL:",
      copied: "URL copied",
      copiedDesc: "The event URL has been copied to clipboard",
      shareButton: "Share event",
      shareTextRevealed: `Photos from the event "${eventName}" have been revealed. Access here:`,
      shareTextActive: `Join the event "${eventName}" on Revelao! 📸`,
      textCopied: "Text copied",
      textCopiedDesc: "The message has been copied to clipboard",
    },
    it: {
      title: "Condividi evento",
      description: "Condividi questo QR o URL per permettere ad altri di unirsi all'evento",
      urlLabel: "URL dell'evento:",
      copied: "URL copiato",
      copiedDesc: "L'URL dell'evento è stato copiato negli appunti",
      shareButton: "Condividi evento",
      shareTextRevealed: `Le foto dell'evento "${eventName}" sono state rivelate. Accedi qui:`,
      shareTextActive: `Unisciti all'evento "${eventName}" su Revelao! 📸`,
      textCopied: "Testo copiato",
      textCopiedDesc: "Il messaggio è stato copiato negli appunti",
    },
  };

  const t = texts[language] || texts.es;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast({
        title: t.copied,
        description: t.copiedDesc,
      });
    } catch (error) {
      console.error("Error copying URL:", error);
    }
  };

  const handleShare = async () => {
    const shareText = isRevealed ? t.shareTextRevealed : t.shareTextActive;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Evento: ${eventName}`,
          text: shareText,
          url: eventUrl,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(`${shareText}\n\n${eventUrl}`);
      toast({
        title: t.textCopied,
        description: t.textCopiedDesc,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>
            {t.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG value={eventUrl} size={200} />
          </div>

          {/* URL */}
          <div className="w-full space-y-2">
            <p className="text-sm text-muted-foreground text-center">{t.urlLabel}</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={eventUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={handleCopyUrl}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Share Button */}
          <Button onClick={handleShare} className="w-full gap-2">
            <Share2 className="w-4 h-4" />
            {t.shareButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;