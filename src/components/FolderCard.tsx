import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, ChevronDown, ChevronRight, Edit, Trash2, Check, X, Image, Settings, CopyPlus, FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import EditFolderDialog from "./EditFolderDialog";
import { exportFolderToPdf } from "@/lib/exportFolderPdf";
import { useAdminI18n } from "@/lib/adminI18n";

export interface EventFolder {
  id: string;
  name: string;
  is_demo: boolean;
  created_at: string;
  custom_image_url: string | null;
  background_image_url: string | null;
  font_family: string | null;
  font_size: string | null;
}

interface FolderEvent {
  id: string;
  name: string;
  password_hash: string;
  reveal_time: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  expiry_date: string | null;
}

interface FolderCardProps {
  folder: EventFolder;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  onDuplicate?: () => void;
  eventCount: number;
  folderEvents: FolderEvent[];
  children: React.ReactNode;
}

const FolderCard = ({
  folder,
  isExpanded,
  onToggle,
  onDelete,
  onUpdate,
  onDuplicate,
  eventCount,
  folderEvents,
  children,
}: FolderCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const { t } = useAdminI18n();

  const handleSave = async () => {
    if (!editName.trim()) return;
    
    try {
      const { error } = await supabase
        .from("event_folders")
        .update({ name: editName.trim() })
        .eq("id", folder.id);

      if (error) throw error;

      toast({
        title: t("folder.updated"),
        description: t("folder.renameDesc"),
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating folder:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("folder.updateError"),
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (eventCount > 0) {
      toast({
        title: t("folder.deleteNotAllowedTitle"),
        description: t("folder.deleteNotAllowedDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!confirm(t("folder.confirmDelete"))) return;

    try {
      const { error } = await supabase
        .from("event_folders")
        .delete()
        .eq("id", folder.id);

      if (error) throw error;

      toast({
        title: t("folder.deletedTitle"),
        description: t("folder.deletedDesc"),
      });
      onDelete();
    } catch (error) {
      console.error("Error deleting folder:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("folder.deleteError"),
        variant: "destructive",
      });
    }
  };

  const handleExportPdf = async () => {
    if (folderEvents.length === 0) {
      toast({
        title: t("folder.exportEmptyTitle"),
        description: t("folder.exportEmptyDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      await exportFolderToPdf(
        {
          id: folder.id,
          name: folder.name,
          custom_image_url: folder.custom_image_url,
        },
        folderEvents
      );
      toast({
        title: t("folder.exportSuccessTitle"),
        description: t("folder.exportSuccessDesc", { count: folderEvents.length }),
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({
        title: t("form.errorTitle"),
        description: t("folder.exportError"),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const hasOverrides = folder.custom_image_url || folder.background_image_url || folder.font_family || folder.font_size;

  return (
    <div className="space-y-2">
      <Card className="p-4 bg-muted/50 border-primary/20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onToggle}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
          
          <Folder className="h-5 w-5 text-primary shrink-0" />
          
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{folder.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({eventCount} {eventCount === 1 ? t("folder.eventSingular") : t("folder.eventPlural")})
                </span>
                {hasOverrides && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    {t("folder.configBadge")}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleExportPdf}
              disabled={isExporting}
              title={t("folder.exportLabel")}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsEditDialogOpen(true)}
              title={t("folder.editConfig")}
            >
              <Settings className="h-4 w-4" />
            </Button>
            {onDuplicate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onDuplicate}
                title={t("folder.duplicateLabel")}
              >
                <CopyPlus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsEditing(true)}
              title={t("folder.editName")}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleDelete}
              title={t("folder.deleteLabel")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <EditFolderDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            folder={folder}
            onUpdate={onUpdate}
          />
        </div>
      </Card>

      {isExpanded && (
        <div className="pl-6 space-y-4 border-l-2 border-primary/20 ml-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default FolderCard;
