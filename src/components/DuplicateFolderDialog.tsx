import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, ImageIcon, FolderOpen } from "lucide-react";
import { EventFolder } from "./FolderCard";

interface DuplicateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: EventFolder;
  eventCount: number;
  totalPhotoCount: number;
  onDuplicate: (newName: string, includePhotos: boolean) => Promise<void>;
}

const DuplicateFolderDialog = ({
  open,
  onOpenChange,
  folder,
  eventCount,
  totalPhotoCount,
  onDuplicate,
}: DuplicateFolderDialogProps) => {
  const [newName, setNewName] = useState(`${folder.name} (copia)`);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleDuplicate = async () => {
    if (!newName.trim()) return;
    
    setIsLoading(true);
    try {
      await onDuplicate(newName.trim(), includePhotos);
      onOpenChange(false);
      setIncludePhotos(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar carpeta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se creará una copia de la carpeta <strong>{folder.name}</strong> con todos sus eventos ({eventCount}).
          </p>

          {/* Folder name input */}
          <div className="space-y-2">
            <Label htmlFor="folder-name" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Nombre de la nueva carpeta
            </Label>
            <Input
              id="folder-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre de la carpeta"
            />
          </div>

          {/* Photos option */}
          {totalPhotoCount > 0 && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="include-photos" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Duplicar fotos
                </Label>
                <p className="text-sm text-muted-foreground">
                  Incluir las {totalPhotoCount} fotos de los eventos
                </p>
              </div>
              <Switch
                id="include-photos"
                checked={includePhotos}
                onCheckedChange={setIncludePhotos}
              />
            </div>
          )}

          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <p>Se duplicarán:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Configuración visual de la carpeta</li>
              <li>{eventCount} evento{eventCount !== 1 ? "s" : ""} con nuevas contraseñas</li>
              {includePhotos && totalPhotoCount > 0 && (
                <li>{totalPhotoCount} foto{totalPhotoCount !== 1 ? "s" : ""}</li>
              )}
            </ul>
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
          <Button onClick={handleDuplicate} disabled={isLoading || !newName.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Duplicando...
              </>
            ) : (
              "Duplicar carpeta"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateFolderDialog;
