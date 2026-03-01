import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";

type DateTimeFieldProps = {
  dateId: string;
  timeId: string;
  dateLabel: ReactNode;
  timeLabel: ReactNode;
  dateValue: string;
  timeValue: string;
  dateMin?: string;
  timeMin?: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  required?: boolean;
};

export const DateTimeField = ({
  dateId,
  timeId,
  dateLabel,
  timeLabel,
  dateValue,
  timeValue,
  dateMin,
  timeMin,
  onDateChange,
  onTimeChange,
  required = false,
}: DateTimeFieldProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={dateId}>{dateLabel}</Label>
        <Input
          id={dateId}
          type="date"
          value={dateValue}
          min={dateMin}
          onChange={(e) => onDateChange(e.target.value)}
          required={required}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={timeId}>{timeLabel}</Label>
        <Input
          id={timeId}
          type="time"
          value={timeValue}
          min={timeMin}
          onChange={(e) => onTimeChange(e.target.value)}
          required={required}
        />
      </div>
    </div>
  );
};
