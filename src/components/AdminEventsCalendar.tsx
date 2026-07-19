import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  max,
  min,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Gamepad2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";

type CalendarEvent = {
  id: string;
  name: string;
  kind: "revelao" | "captains";
  createdAt: string;
  startsAt: string | null;
  endsAt: string | null;
};

type CalendarSegment = {
  event: CalendarEvent;
  startColumn: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

const palette = [
  { background: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  { background: "#ffedd5", border: "#f97316", text: "#9a3412" },
  { background: "#fef3c7", border: "#eab308", text: "#854d0e" },
  { background: "#dcfce7", border: "#22c55e", text: "#166534" },
  { background: "#ccfbf1", border: "#14b8a6", text: "#115e59" },
  { background: "#cffafe", border: "#06b6d4", text: "#155e75" },
  { background: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  { background: "#e0e7ff", border: "#6366f1", text: "#3730a3" },
  { background: "#ede9fe", border: "#8b5cf6", text: "#5b21b6" },
  { background: "#fae8ff", border: "#d946ef", text: "#86198f" },
  { background: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  { background: "#f1f5f9", border: "#64748b", text: "#334155" },
];

const colorForEvent = (id: string) => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = ((hash << 5) - hash + id.charCodeAt(index)) | 0;
  return palette[Math.abs(hash) % palette.length];
};

const safeDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
};

const splitWeeks = <T,>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, index * size + size));

const buildSegments = (events: CalendarEvent[], week: Date[]): CalendarSegment[] => {
  const weekStart = week[0];
  const weekEnd = week[6];
  const occupiedUntil: number[] = [];

  return events
    .map((event) => {
      const eventStart = safeDate(event.startsAt);
      const eventEnd = safeDate(event.endsAt) || eventStart;
      if (!eventStart || !eventEnd || eventEnd < weekStart || eventStart > weekEnd) return null;
      const visibleStart = max([eventStart, weekStart]);
      const visibleEnd = min([eventEnd, weekEnd]);
      const startColumn = week.findIndex((day) => isSameDay(day, visibleStart));
      const endColumn = week.findIndex((day) => isSameDay(day, visibleEnd));
      return { event, eventStart, eventEnd, startColumn, endColumn };
    })
    .filter(Boolean)
    .sort((a, b) => a!.startColumn - b!.startColumn || b!.endColumn - a!.endColumn)
    .map((item) => {
      const value = item!;
      let lane = occupiedUntil.findIndex((lastColumn) => lastColumn < value.startColumn);
      if (lane === -1) lane = occupiedUntil.length;
      occupiedUntil[lane] = value.endColumn;
      return {
        event: value.event,
        startColumn: value.startColumn,
        span: value.endColumn - value.startColumn + 1,
        lane,
        continuesBefore: value.eventStart < weekStart,
        continuesAfter: value.eventEnd > weekEnd,
      };
    });
};

export const AdminEventsCalendar = ({
  events,
  onOpen,
}: {
  events: CalendarEvent[];
  onOpen: (event: CalendarEvent) => void;
}) => {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const weeks = useMemo(() => {
    const firstDay = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const lastDay = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    return splitWeeks(eachDayOfInterval({ start: firstDay, end: lastDay }), 7);
  }, [visibleMonth]);

  const creationEventsByDay = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const createdAt = safeDate(event.createdAt);
      if (!createdAt) continue;
      const key = format(createdAt, "yyyy-MM-dd");
      result.set(key, [...(result.get(key) || []), event]);
    }
    return result;
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold capitalize">{format(visibleMonth, "MMMM yyyy", { locale: es })}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-current bg-transparent" /> Fecha de creación</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-8 rounded-full bg-[#f06a5f]" /> Duración del evento</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setVisibleMonth((month) => subMonths(month, 1))} aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setVisibleMonth(startOfMonth(new Date()))}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => setVisibleMonth((month) => addMonths(month, 1))} aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-7 border-b border-border bg-muted/50">
            {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{day}</div>
            ))}
          </div>

          {weeks.map((week) => {
            const segments = buildSegments(events, week);
            const laneCount = Math.max(0, ...segments.map((segment) => segment.lane + 1));
            const maximumCreations = Math.max(0, ...week.map((day) => creationEventsByDay.get(format(day, "yyyy-MM-dd"))?.length || 0));
            const rowHeight = Math.max(132, 48 + laneCount * 27 + Math.min(maximumCreations, 3) * 23);
            return (
              <div key={week[0].toISOString()} className="relative border-b border-border last:border-b-0" style={{ height: rowHeight }}>
                <div className="absolute inset-0 grid grid-cols-7">
                  {week.map((day) => {
                    const creations = creationEventsByDay.get(format(day, "yyyy-MM-dd")) || [];
                    return (
                      <div key={day.toISOString()} className={`border-r border-border p-2 last:border-r-0 ${isSameMonth(day, visibleMonth) ? 'bg-background' : 'bg-muted/20'}`}>
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday(day) ? 'bg-foreground text-background' : isSameMonth(day, visibleMonth) ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1" style={{ marginTop: laneCount * 27 + 6 }}>
                          {creations.slice(0, 3).map((event) => {
                            const color = colorForEvent(event.id);
                            return (
                              <button
                                key={`${event.kind}-${event.id}-created`}
                                type="button"
                                onClick={() => onOpen(event)}
                                className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                style={{ color: color.text, backgroundColor: color.background }}
                                title={`Creado: ${event.name}`}
                              >
                                <span className="h-2 w-2 shrink-0 rounded-full border-2" style={{ borderColor: color.border }} />
                                <span className="truncate">Creado · {event.name}</span>
                              </button>
                            );
                          })}
                          {creations.length > 3 ? <div className="px-1 text-[10px] text-muted-foreground">+{creations.length - 3} creados</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pointer-events-none absolute left-0 right-0 top-9 grid grid-cols-7 gap-y-1" style={{ gridAutoRows: '23px' }}>
                  {segments.map((segment) => {
                    const color = colorForEvent(segment.event.id);
                    const Icon = segment.event.kind === 'captains' ? Gamepad2 : Image;
                    return (
                      <button
                        key={`${segment.event.kind}-${segment.event.id}-${week[0].toISOString()}`}
                        type="button"
                        onClick={() => onOpen(segment.event)}
                        className={`pointer-events-auto mx-0.5 flex min-w-0 items-center gap-1 truncate border-l-4 px-1.5 text-left text-[11px] font-bold shadow-sm hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${segment.continuesBefore ? 'rounded-l-none' : 'rounded-l-md'} ${segment.continuesAfter ? 'rounded-r-none' : 'rounded-r-md'}`}
                        style={{
                          gridColumn: `${segment.startColumn + 1} / span ${segment.span}`,
                          gridRow: segment.lane + 1,
                          color: color.text,
                          backgroundColor: color.background,
                          borderLeftColor: color.border,
                        }}
                        title={`${segment.event.kind === 'captains' ? 'Capitanes' : 'Revelao'}: ${segment.event.name}`}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{segment.event.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

