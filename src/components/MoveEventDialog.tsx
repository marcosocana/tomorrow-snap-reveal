import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Folder, Home } from "lucide-react";
import { EventFolder } from "./FolderCard";

interface MoveEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: EventFolder[];
  currentFolderId: string | null;
  onMove: (folderId: string | null) => void;
}

const MoveEventDialog = ({
  open,
  onOpenChange,
  folders,
  currentFolderId,
  onMove,
}: MoveEventDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover evento a...</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          <Button
            variant={currentFolderId === null ? "secondary" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => {
              onMove(null);
              onOpenChange(false);
            }}
          >
            <Home className="h-4 w-4" />
            Listado general
          </Button>

          {folders.map((folder) => (
            <Button
              key={folder.id}
              variant={currentFolderId === folder.id ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => {
                onMove(folder.id);
                onOpenChange(false);
              }}
            >
              <Folder className="h-4 w-4" />
              {folder.name}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MoveEventDialog;
