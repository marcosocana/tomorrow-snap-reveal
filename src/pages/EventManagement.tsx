import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ArrowLeft, Plus, Trash2, Edit, Eye, Copy } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Event {
  id: string;
  name: string;
  password_hash: string;
  admin_password: string | null;
  reveal_time: string;
  upload_start_time: string | null;
  upload_end_time: string | null;
  max_photos: number | null;
  created_at: string;
}

const EventManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [newEvent, setNewEvent] = useState({
    name: "",
    password: "",
    adminPassword: "",
    uploadStartDate: "",
    uploadStartTime: "00:00",
    uploadEndDate: "",
    uploadEndTime: "23:59",
    revealDate: "",
    revealTime: "12:00",
    maxPhotos: "",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/admin-login");
        return;
      }
      loadEvents();
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/admin-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error loading events:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los eventos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const uploadStartDateTime = new Date(`${newEvent.uploadStartDate}T${newEvent.uploadStartTime}`);
      const uploadEndDateTime = new Date(`${newEvent.uploadEndDate}T${newEvent.uploadEndTime}`);
      const revealDateTime = new Date(`${newEvent.revealDate}T${newEvent.revealTime}`);

      if (editingEvent) {
        // Update existing event
        const { error } = await supabase
          .from("events")
          .update({
            name: newEvent.name,
            password_hash: newEvent.password,
            admin_password: newEvent.adminPassword || null,
            upload_start_time: uploadStartDateTime.toISOString(),
            upload_end_time: uploadEndDateTime.toISOString(),
            reveal_time: revealDateTime.toISOString(),
            max_photos: newEvent.maxPhotos ? parseInt(newEvent.maxPhotos) : null,
          })
          .eq("id", editingEvent.id);

        if (error) throw error;

        toast({
          title: "Evento actualizado",
          description: "El evento se actualizó correctamente",
        });
      } else {
        // Create new event
        const { error } = await supabase.from("events").insert({
          name: newEvent.name,
          password_hash: newEvent.password,
          admin_password: newEvent.adminPassword || null,
          upload_start_time: uploadStartDateTime.toISOString(),
          upload_end_time: uploadEndDateTime.toISOString(),
          reveal_time: revealDateTime.toISOString(),
          max_photos: newEvent.maxPhotos ? parseInt(newEvent.maxPhotos) : null,
        });

        if (error) throw error;

        toast({
          title: "Evento creado",
          description: "El evento se creó correctamente",
        });
      }

      setNewEvent({
        name: "",
        password: "",
        adminPassword: "",
        uploadStartDate: "",
        uploadStartTime: "00:00",
        uploadEndDate: "",
        uploadEndTime: "23:59",
        revealDate: "",
        revealTime: "12:00",
        maxPhotos: "",
      });
      setEditingEvent(null);
      setIsDialogOpen(false);
      loadEvents();
    } catch (error) {
      console.error("Error saving event:", error);
      toast({
        title: "Error",
        description: editingEvent ? "No se pudo actualizar el evento" : "No se pudo crear el evento",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditEvent = (event: Event) => {
    const uploadStartDate = event.upload_start_time ? new Date(event.upload_start_time) : new Date();
    const uploadEndDate = event.upload_end_time ? new Date(event.upload_end_time) : new Date();
    const revealDate = new Date(event.reveal_time);
    setEditingEvent(event);
    setNewEvent({
      name: event.name,
      password: event.password_hash,
      adminPassword: event.admin_password || "",
      uploadStartDate: format(uploadStartDate, "yyyy-MM-dd"),
      uploadStartTime: format(uploadStartDate, "HH:mm"),
      uploadEndDate: format(uploadEndDate, "yyyy-MM-dd"),
      uploadEndTime: format(uploadEndDate, "HH:mm"),
      revealDate: format(revealDate, "yyyy-MM-dd"),
      revealTime: format(revealDate, "HH:mm"),
      maxPhotos: event.max_photos ? event.max_photos.toString() : "",
    });
    setIsDialogOpen(true);
  };

  const handleRevealNow = async (eventId: string) => {
    if (!confirm("¿Revelar todas las fotos ahora?")) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ reveal_time: new Date().toISOString() })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Fotos reveladas",
        description: "Las fotos ya son visibles para todos",
      });

      loadEvents();
    } catch (error) {
      console.error("Error revealing photos:", error);
      toast({
        title: "Error",
        description: "No se pudieron revelar las fotos",
        variant: "destructive",
      });
    }
  };

  const handleReopenEvent = async (eventId: string) => {
    if (!confirm("¿Abrir evento de nuevo? Se podrán subir más fotos y se establecerá una nueva fecha de revelado.")) return;

    try {
      // Set reveal time to 24 hours from now
      const newRevealTime = new Date();
      newRevealTime.setHours(newRevealTime.getHours() + 24);

      const { error } = await supabase
        .from("events")
        .update({ reveal_time: newRevealTime.toISOString() })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Evento reabierto",
        description: "El evento se ha abierto de nuevo. Las fotos se revelarán en 24 horas.",
      });

      loadEvents();
    } catch (error) {
      console.error("Error reopening event:", error);
      toast({
        title: "Error",
        description: "No se pudo reabrir el evento",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este evento?")) return;

    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Evento eliminado",
        description: "El evento se eliminó correctamente",
      });

      loadEvents();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el evento",
        variant: "destructive",
      });
    }
  };

  const handleCopyUrl = async (password: string) => {
    const eventUrl = `https://acceso.revelao.cam/events/${password}`;
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando eventos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate("/admin-login");
              }}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">
              Gestión de Eventos
            </h1>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingEvent(null);
              setNewEvent({
                name: "",
                password: "",
                adminPassword: "",
                uploadStartDate: "",
                uploadStartTime: "00:00",
                uploadEndDate: "",
                uploadEndTime: "23:59",
                revealDate: "",
                revealTime: "12:00",
                maxPhotos: "",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingEvent ? "Editar Evento" : "Crear Nuevo Evento"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del evento</Label>
                  <Input
                    id="name"
                    value={newEvent.name}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña del evento</Label>
                  <Input
                    id="password"
                    type="text"
                    value={newEvent.password}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, password: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPassword">
                    Contraseña admin (ver fotos antes del revelado)
                  </Label>
                  <Input
                    id="adminPassword"
                    type="text"
                    value={newEvent.adminPassword}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, adminPassword: e.target.value })
                    }
                    placeholder="Opcional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxPhotos">
                    Máximo de fotos permitido
                  </Label>
                  <Input
                    id="maxPhotos"
                    type="number"
                    min="1"
                    value={newEvent.maxPhotos}
                    onChange={(e) =>
                      setNewEvent({ ...newEvent, maxPhotos: e.target.value })
                    }
                    placeholder="Ilimitado si se deja vacío"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Período de subida de fotos</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="uploadStartDate">Fecha inicio</Label>
                      <Input
                        id="uploadStartDate"
                        type="date"
                        value={newEvent.uploadStartDate}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, uploadStartDate: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="uploadStartTime">Hora inicio</Label>
                      <Input
                        id="uploadStartTime"
                        type="time"
                        value={newEvent.uploadStartTime}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, uploadStartTime: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="uploadEndDate">Fecha fin</Label>
                      <Input
                        id="uploadEndDate"
                        type="date"
                        value={newEvent.uploadEndDate}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, uploadEndDate: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="uploadEndTime">Hora fin</Label>
                      <Input
                        id="uploadEndTime"
                        type="time"
                        value={newEvent.uploadEndTime}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, uploadEndTime: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Fecha de revelado</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="revealDate">Fecha</Label>
                      <Input
                        id="revealDate"
                        type="date"
                        value={newEvent.revealDate}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, revealDate: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="revealTime">Hora</Label>
                      <Input
                        id="revealTime"
                        type="time"
                        value={newEvent.revealTime}
                        onChange={(e) =>
                          setNewEvent({ ...newEvent, revealTime: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isCreating}>
                  {isCreating 
                    ? (editingEvent ? "Actualizando..." : "Creando...") 
                    : (editingEvent ? "Actualizar Evento" : "Crear Evento")
                  }
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {events.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No hay eventos creados todavía
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => {
              const revealTime = new Date(event.reveal_time);
              const now = new Date();
              const isRevealed = now >= revealTime;

              const eventUrl = `https://acceso.revelao.cam/events/${event.password_hash}`;

              return (
                <Card key={event.id} className="p-6">
                  <div className="flex flex-col lg:flex-row items-start gap-6">
                    {/* QR Code Section */}
                    <div className="flex-shrink-0">
                      <div className="bg-white p-3 rounded-lg border border-border">
                        <QRCodeSVG value={eventUrl} size={120} />
                      </div>
                    </div>

                    {/* Event Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-semibold text-foreground">
                          {event.name}
                        </h3>
                        {isRevealed && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            Revelado
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>
                          <span className="font-medium">Contraseña:</span>{" "}
                          {event.password_hash}
                        </p>
                        {event.admin_password && (
                          <p>
                            <span className="font-medium">Contraseña admin:</span>{" "}
                            {event.admin_password}
                          </p>
                        )}
                        {event.max_photos && (
                          <p>
                            <span className="font-medium">Máximo de fotos:</span>{" "}
                            {event.max_photos}
                          </p>
                        )}
                        {event.upload_start_time && event.upload_end_time && (
                          <p>
                            <span className="font-medium">Período de subida:</span>{" "}
                            {format(new Date(event.upload_start_time), "dd/MM/yyyy HH:mm", { locale: es })} - {format(new Date(event.upload_end_time), "dd/MM/yyyy HH:mm", { locale: es })}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Fecha de revelado:</span>{" "}
                          {format(revealTime, "PPP 'a las' HH:mm", {
                            locale: es,
                          })}
                        </p>
                        <p>
                          <span className="font-medium">Creado:</span>{" "}
                          {format(new Date(event.created_at), "PPP", { locale: es })}
                        </p>
                      </div>

                      {/* URL Section */}
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
                          onClick={() => handleCopyUrl(event.password_hash)}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex lg:flex-col gap-2">
                      {isRevealed ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReopenEvent(event.id)}
                          className="text-primary hover:text-primary hover:bg-primary/10"
                          title="Abrir evento de nuevo"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevealNow(event.id)}
                          className="text-primary hover:text-primary hover:bg-primary/10"
                          title="Revelar ahora"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditEvent(event)}
                        className="hover:bg-muted"
                        title="Editar evento"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Eliminar evento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventManagement;
