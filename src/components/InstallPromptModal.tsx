import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
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
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  
  // Verificar si ya vio el modal
  const hasSeenModal = localStorage.getItem("hasSeenInstallModal");
  const [showModal, setShowModal] = useState(false);

  // No mostrar en páginas de login o acceso a eventos
  const shouldShow = !['/', '/event-management'].some(path => location.pathname === path) && 
                     !location.pathname.startsWith('/event/');

  useEffect(() => {
    console.log("InstallPromptModal - hasSeenModal:", hasSeenModal, "showModal:", showModal);

    // Solo mostrar si no ha visto el modal y está en una página válida
    if (!hasSeenModal && shouldShow) {
      setShowModal(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log("InstallPromptModal - beforeinstallprompt event received");
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [hasSeenModal, shouldShow]);

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

  const handleModalClose = (open: boolean) => {
    setShowModal(open);
    if (!open) {
      // Solo guardamos la flag cuando el usuario cierra el modal
      localStorage.setItem("hasSeenInstallModal", "true");
      console.log("InstallPromptModal - Modal closed, flag saved");
    }
  };

  console.log("InstallPromptModal - Rendering. showModal:", showModal, "canInstall:", canInstall, "isIOS:", isIOS, "isAndroid:", isAndroid);

  return (
    <Dialog open={showModal} onOpenChange={handleModalClose}>
      <DialogContent className="bg-background border-2 border-primary/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">
            📸 ¡Instala Revelao!
          </DialogTitle>
          <DialogDescription className="text-foreground/80 space-y-4 pt-4">
            <p className="text-base">
              Añade Revelao a tu pantalla de inicio para acceder rápidamente y disfrutar de una experiencia como app nativa.
            </p>

            <div className="pt-2">
              <Button 
                onClick={handleInstallClick}
                className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold"
                size="lg"
              >
                Añadir
              </Button>
            </div>

            {isIOS && (
              <div className="space-y-3 text-sm bg-muted/50 p-4 rounded-lg mt-4">
                <p className="font-semibold">Instrucciones para iOS:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Toca el botón de compartir <span className="font-bold">⎙</span></li>
                  <li>Selecciona "Añadir a pantalla de inicio"</li>
                  <li>Confirma tocando "Añadir"</li>
                </ol>
              </div>
            )}

            {isAndroid && !canInstall && (
              <div className="space-y-3 text-sm bg-muted/50 p-4 rounded-lg mt-4">
                <p className="font-semibold">Instrucciones para Android:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Toca el botón "Añadir" arriba</li>
                  <li>O abre el menú del navegador (⋮) y selecciona "Añadir a pantalla de inicio"</li>
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
