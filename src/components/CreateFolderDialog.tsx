import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import FontSelect from "./FontSelect";
import FontSizeSelect, { FontSizeOption } from "./FontSizeSelect";
import { EventFontFamily, getEventFontFamily } from "@/lib/eventFonts";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDemoMode: boolean;
  onCreate: () => void;
}

const CreateFolderDialog = ({
  open,
  onOpenChange,
  isDemoMode,
  onCreate,
}: CreateFolderDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [backgroundImageUrl, setBackgroundImageUrl] = useState("");
  const [fontFamily, setFontFamily] = useState<EventFontFamily | null>(null);
  const [fontSize, setFontSize] = useState<FontSizeOption | null>(null);
  const [uploadingImage, setUploadingImage] = useState<"custom" | "background" | null>(null);
  const { toast } = useToast();

  const handleImageUpload = async (file: File, type: "custom" | "background") => {
    try {
      setUploadingImage(type);
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `folder-images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event-photos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("event-photos")
        .getPublicUrl(filePath);

      if (type === "custom") {
        setCustomImageUrl(publicUrl);
      } else {
        setBackgroundImageUrl(publicUrl);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        title: "Error",
        description: "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(null);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la carpeta es obligatorio",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from("event_folders").insert({
        name: name.trim(),
        is_demo: isDemoMode,
        custom_image_url: customImageUrl || null,
        background_image_url: backgroundImageUrl || null,
        font_family: fontFamily,
        font_size: fontSize,
      });

      if (error) throw error;

      toast({
        title: "Carpeta creada",
        description: "La carpeta se ha creado correctamente",
      });

      // Reset form
      setName("");
      setCustomImageUrl("");
      setBackgroundImageUrl("");
      setFontFamily(null);
      setFontSize(null);
      onOpenChange(false);
      onCreate();
    } catch (error) {
      console.error("Error creating folder:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la carpeta",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folderName">Nombre de la carpeta *</Label>
            <Input
              id="folderName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Eventos de verano"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">
              Configuración de carpeta (opcional)
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Estos valores sobreescribirán la configuración individual de los eventos dentro de la carpeta.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Imagen personalizada</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, "custom");
                    }}
                    disabled={uploadingImage === "custom"}
                    className="flex-1"
                  />
                  {customImageUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setCustomImageUrl("")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {customImageUrl && (
                  <img
                    src={customImageUrl}
                    alt="Custom preview"
                    className="max-w-[120px] max-h-[60px] object-contain rounded border"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Fotografía de fondo</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, "background");
                    }}
                    disabled={uploadingImage === "background"}
                    className="flex-1"
                  />
                  {backgroundImageUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setBackgroundImageUrl("")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {backgroundImageUrl && (
                  <img
                    src={backgroundImageUrl}
                    alt="Background preview"
                    className="max-w-[200px] max-h-[100px] object-contain rounded border"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Tipografía del título</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <FontSelect
                      value={fontFamily || "system"}
                      onChange={(font) => setFontFamily(font)}
                      previewText="Título del evento"
                    />
                  </div>
                  {fontFamily && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFontFamily(null)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tamaño del título</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <FontSizeSelect
                      value={fontSize || "text-3xl"}
                      onChange={(size) => setFontSize(size)}
                      previewText="Título del evento"
                      fontFamily={fontFamily ? getEventFontFamily(fontFamily) : undefined}
                    />
                  </div>
                  {fontSize && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFontSize(null)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isLoading || !name.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear carpeta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFolderDialog;
