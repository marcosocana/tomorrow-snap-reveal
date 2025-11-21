import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Upload, X, CheckCircle2 } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

interface UploadItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
}

const BulkUpload = () => {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const eventId = localStorage.getItem("eventId");
  const eventName = localStorage.getItem("eventName");

  useEffect(() => {
    if (!eventId) {
      navigate("/");
      return;
    }

    // Check if bulk upload mode is enabled
    const bulkMode = localStorage.getItem("bulkUploadMode");
    if (!bulkMode) {
      navigate("/camera");
      return;
    }
  }, [eventId, navigate]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const newItems: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: "pending",
      progress: 0,
    }));

    setUploadItems((prev) => [...prev, ...newItems]);

    // Reset input
    if (event.target) {
      event.target.value = "";
    }
  };

  const removeItem = (id: string) => {
    setUploadItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUploadAll = async () => {
    if (!eventId || uploadItems.length === 0) return;

    setIsUploading(true);

    for (let i = 0; i < uploadItems.length; i++) {
      const item = uploadItems[i];
      if (item.status === "success") continue;

      // Update status to uploading
      setUploadItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: "uploading", progress: 0 } : it
        )
      );

      try {
        // Compress image
        const compressedFile = await compressImage(item.file, 1);

        // Update progress
        setUploadItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, progress: 30 } : it))
        );

        const fileName = `${eventId}/${Date.now()}-${i}.jpg`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("event-photos")
          .upload(fileName, compressedFile);

        if (uploadError) throw uploadError;

        // Update progress
        setUploadItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, progress: 70 } : it))
        );

        // Save photo record
        const { error: dbError } = await supabase.from("photos").insert({
          event_id: eventId,
          image_url: fileName,
        });

        if (dbError) throw dbError;

        // Update status to success
        setUploadItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? { ...it, status: "success", progress: 100 }
              : it
          )
        );
      } catch (error) {
        console.error("Error uploading photo:", error);
        setUploadItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: "error", progress: 0 } : it
          )
        );
      }
    }

    setIsUploading(false);
    toast({
      title: "Subida completada",
      description: `Se subieron ${
        uploadItems.filter((it) => it.status === "success").length
      } fotos correctamente`,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("eventId");
    localStorage.removeItem("eventName");
    localStorage.removeItem("bulkUploadMode");
    navigate("/");
  };

  const pendingCount = uploadItems.filter((it) => it.status === "pending")
    .length;
  const successCount = uploadItems.filter((it) => it.status === "success")
    .length;
  const errorCount = uploadItems.filter((it) => it.status === "error").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="p-4 flex justify-between items-center bg-card border-b border-border">
        <div>
          <h1 className="text-xl font-bold text-foreground">{eventName}</h1>
          <p className="text-sm text-muted-foreground">Carga múltiple</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-5 h-5" />
        </Button>
      </header>

      <div className="flex-1 flex flex-col p-6 space-y-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            Subida masiva de fotos
          </h2>
          <p className="text-muted-foreground">
            Selecciona múltiples fotos para subirlas todas al evento
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Seleccionar fotos
          </Button>

          {uploadItems.length > 0 && (
            <Button
              onClick={handleUploadAll}
              disabled={isUploading || pendingCount === 0}
              className="flex items-center gap-2"
            >
              {isUploading ? "Subiendo..." : `Subir todo (${pendingCount})`}
            </Button>
          )}
        </div>

        {uploadItems.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-semibold text-foreground">
                Total: {uploadItems.length} fotos
              </p>
              <div className="flex gap-4 text-xs">
                <span className="text-muted-foreground">
                  Pendientes: {pendingCount}
                </span>
                <span className="text-green-500">Exitosas: {successCount}</span>
                {errorCount > 0 && (
                  <span className="text-destructive">Errores: {errorCount}</span>
                )}
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {uploadItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-background rounded border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(item.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {item.status === "uploading" && (
                      <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        disabled={isUploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {item.status === "uploading" && (
                      <div className="w-8 h-8 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                      </div>
                    )}
                    {item.status === "success" && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {item.status === "error" && (
                      <X className="w-5 h-5 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadItems.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                No hay fotos seleccionadas
              </p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default BulkUpload;
