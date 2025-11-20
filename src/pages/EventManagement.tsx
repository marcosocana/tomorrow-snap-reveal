import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar, ArrowLeft, Plus, Trash2, Edit, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
    revealDate: "",
    revealTime: "12:00",
  });
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadEvents();
  }, []);

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
      const revealDateTime = new Date(`${newEvent.revealDate}T${newEvent.revealTime}`);

      if (editingEvent) {
        // Update existing event
        const { error } = await supabase
          .from("events")
          .update({
            name: newEvent.name,
            password_hash: newEvent.password,
            admin_password: newEvent.adminPassword || null,
            reveal_time: revealDateTime.toISOString(),
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
          reveal_time: revealDateTime.toISOString(),
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
        revealDate: "",
        revealTime: "12:00",
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
    const revealDate = new Date(event.reveal_time);
    setEditingEvent(event);
    setNewEvent({
      name: event.name,
      password: event.password_hash,
      adminPassword: event.admin_password || "",
      revealDate: format(revealDate, "yyyy-MM-dd"),
      revealTime: format(revealDate, "HH:mm"),
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
              onClick={() => navigate("/")}
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
                revealDate: "",
                revealTime: "12:00",
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="revealDate">Fecha de revelado</Label>
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

              return (
                <Card key={event.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
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
                    </div>

                    <div className="flex gap-2">
                      {!isRevealed && (
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
