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

interface ShareDialogProps {
  eventPassword: string;
  eventName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ShareDialog = ({ eventPassword, eventName, open, onOpenChange }: ShareDialogProps) => {
  const { toast } = useToast();
  const eventUrl = `${window.location.origin}/event/${eventPassword}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(eventUrl);
      toast({
        title: "URL copiada",
        description: "La URL del evento se ha copiado al portapapeles",
      });
    } catch (error) {
      console.error("Error copying URL:", error);
    }
  };

  const handleShare = async () => {
    const shareText = `¡Únete al evento "${eventName}" en Revelao! 📸\n\nAccede directamente aquí: ${eventUrl}`;
    
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
      await navigator.clipboard.writeText(shareText);
      toast({
        title: "Texto copiado",
        description: "El mensaje se ha copiado al portapapeles",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir evento</DialogTitle>
          <DialogDescription>
            Comparte este QR o URL para que otros puedan unirse al evento
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* QR Code */}
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG value={eventUrl} size={200} />
          </div>

          {/* URL */}
          <div className="w-full space-y-2">
            <p className="text-sm text-muted-foreground text-center">URL del evento:</p>
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
            Compartir evento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
