import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const InstallPromptModal = () => {
  const [showModal, setShowModal] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const hasSeenModal = localStorage.getItem("hasSeenInstallModal");
    
    if (!hasSeenModal) {
      setShowModal(true);
      localStorage.setItem("hasSeenInstallModal", "true");
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("Instalación aceptada");
    }
    
    setDeferredPrompt(null);
    setCanInstall(false);
    setShowModal(false);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="bg-background border-2 border-primary/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            📸 ¡Instala Revelao!
          </DialogTitle>
          <DialogDescription className="text-foreground/80 space-y-4 pt-4">
            <p className="text-base">
              Añade Revelao a tu pantalla de inicio para acceder rápidamente y disfrutar de una experiencia como app nativa.
            </p>

            {canInstall && !isIOS && (
              <div className="pt-2">
                <Button 
                  onClick={handleInstallClick}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  Añadir acceso directo
                </Button>
              </div>
            )}

            {isIOS && (
              <div className="space-y-3 text-sm bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold">En iOS (iPhone/iPad):</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Toca el botón de compartir <span className="font-bold">⎙</span></li>
                  <li>Selecciona "Añadir a pantalla de inicio"</li>
                  <li>Confirma tocando "Añadir"</li>
                </ol>
              </div>
            )}

            {isAndroid && !canInstall && (
              <div className="space-y-3 text-sm bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold">En Android:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Abre el menú del navegador (⋮)</li>
                  <li>Selecciona "Añadir a pantalla de inicio" o "Instalar app"</li>
                  <li>Confirma la instalación</li>
                </ol>
              </div>
            )}

            {!isIOS && !isAndroid && !canInstall && (
              <div className="space-y-3 text-sm bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold">En tu navegador:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Busca la opción "Instalar" en el menú</li>
                  <li>O usa el menú del navegador para añadir a inicio</li>
                </ol>
              </div>
            )}

            <p className="text-xs text-muted-foreground pt-2">
              Podrás cerrar este mensaje y volver más tarde desde el menú de tu navegador.
            </p>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};
