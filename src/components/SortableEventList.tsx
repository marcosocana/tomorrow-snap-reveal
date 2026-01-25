import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SortableEventCard from "./SortableEventCard";

interface SortableEventListProps<T extends { id: string; sort_order: number }> {
  events: T[];
  folderId: string;
  onReorder: () => void;
  renderEventCard: (event: T) => React.ReactNode;
}

function SortableEventList<T extends { id: string; sort_order: number }>({
  events,
  folderId,
  onReorder,
  renderEventCard,
}: SortableEventListProps<T>) {
  const [items, setItems] = useState(events);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update items when events prop changes
  if (events.length !== items.length || events.some((e, i) => e.id !== items[i]?.id)) {
    setItems(events);
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);

      // Update sort_order in database
      try {
        const updates = newItems.map((item, index) => ({
          id: item.id,
          sort_order: index + 1,
        }));

        for (const update of updates) {
          await supabase
            .from("events")
            .update({ sort_order: update.sort_order })
            .eq("id", update.id);
        }

        onReorder();
      } catch (error) {
        console.error("Error updating sort order:", error);
        toast({
          title: "Error",
          description: "No se pudo guardar el orden",
          variant: "destructive",
        });
        // Revert on error
        setItems(events);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((e) => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {items.map((event) => (
            <SortableEventCard key={event.id} id={event.id}>
              {renderEventCard(event)}
            </SortableEventCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default SortableEventList;
