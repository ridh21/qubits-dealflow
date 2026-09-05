"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarBlank } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** UI dates use local calendar days; services decide the business timezone. */
export function DatePicker({
  value,
  onChange,
  label,
  disabled,
  fromDate,
  hideLabel,
  className,
}: {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  label: string;
  disabled?: boolean;
  fromDate?: Date;
  /** Drop the visible label where the surrounding layout already names it. */
  hideLabel?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className={cn("w-full justify-start font-normal", className)}
        >
          <CalendarBlank className="size-4" />
          {/* Once a date is chosen the button shows the date, so without a
              standing label the field would no longer say what it is. */}
          {value ? (
            format(value, "d MMM yyyy")
          ) : (
            <span className="text-muted-foreground">Select a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          defaultMonth={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
          disabled={fromDate ? { before: fromDate } : undefined}
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            className="m-2"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            Clear date
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );

  if (hideLabel) return trigger;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {trigger}
    </div>
  );
}
