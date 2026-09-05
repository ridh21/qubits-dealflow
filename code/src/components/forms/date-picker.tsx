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

/** UI dates use local calendar days; services decide the business timezone. */
export function DatePicker({
  value,
  onChange,
  label,
  disabled,
  fromDate,
}: {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  label: string;
  disabled?: boolean;
  fromDate?: Date;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className="justify-start font-normal"
        >
          <CalendarBlank className="size-4" />
          {value ? format(value, "d MMM yyyy") : label}
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
}
