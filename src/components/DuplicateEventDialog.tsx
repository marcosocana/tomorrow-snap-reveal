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
import { Folder, Home, Loader2, ImageIcon } from "lucide-react";
import { EventFolder } from "./FolderCard";
import { useAdminI18n } from "@/lib/adminI18n";

interface DuplicateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: EventFolder[];
  eventName: string;
  eventPassword: string;
  photoCount?: number;
  onDuplicate: (folderId: string | null, includePhotos: boolean) => Promise<void>;
}

const DuplicateEventDialog = ({
  open,
  onOpenChange,
  folders,
  eventName,
  eventPassword,
  photoCount = 0,
  onDuplicate,
}: DuplicateEventDialogProps) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useAdminI18n();

  const handleDuplicate = async () => {
    setIsLoading(true);
    try {
      await onDuplicate(selectedFolderId, includePhotos);
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
          <DialogTitle>{t("duplicateEvent.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("duplicateEvent.desc", { name: eventName })}
          </p>

          {/* Photos option */}
          {photoCount > 0 && (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="include-photos" className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {t("duplicateEvent.includePhotos")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("duplicateEvent.includePhotosDesc", { count: photoCount })}
                </p>
              </div>
              <Switch
                id="include-photos"
                checked={includePhotos}
                onCheckedChange={setIncludePhotos}
              />
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">{t("duplicateEvent.locationQuestion")}</p>
            
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              <Button
                variant={selectedFolderId === null ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setSelectedFolderId(null)}
              >
                <Home className="h-4 w-4" />
                {t("duplicateEvent.generalList")}
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
            {t("shared.cancel")}
          </Button>
          <Button onClick={handleDuplicate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("duplicateEvent.duplicating")}
              </>
            ) : (
              t("duplicateEvent.action")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateEventDialog;
