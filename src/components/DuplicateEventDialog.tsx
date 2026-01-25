import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, Home, Loader2 } from "lucide-react";
import { EventFolder } from "./FolderCard";

interface DuplicateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: EventFolder[];
  eventName: string;
  eventPassword: string;
  onDuplicate: (folderId: string | null) => Promise<void>;
}

const DuplicateEventDialog = ({
  open,
  onOpenChange,
  folders,
  eventName,
  eventPassword,
  onDuplicate,
}: DuplicateEventDialogProps) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleDuplicate = async () => {
    setIsLoading(true);
    try {
      await onDuplicate(selectedFolderId);
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicar evento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se creará una copia del evento <strong>{eventName}</strong> con una contraseña diferente.
          </p>

          <div className="space-y-2">
            <p className="text-sm font-medium">¿Dónde quieres colocar el duplicado?</p>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <Button
                variant={selectedFolderId === null ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setSelectedFolderId(null)}
              >
                <Home className="h-4 w-4" />
                Listado general
              </Button>

              {folders.map((folder) => (
                <Button
                  key={folder.id}
                  variant={selectedFolderId === folder.id ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  <Folder className="h-4 w-4" />
                  {folder.name}
                </Button>
              ))}
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
          <Button onClick={handleDuplicate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Duplicando...
              </>
            ) : (
              "Duplicar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateEventDialog;
