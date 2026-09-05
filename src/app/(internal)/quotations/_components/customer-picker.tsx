"use client";
import { useId, useState } from "react";
import { CaretUpDown, Check } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type CustomerOption = { id: string; name: string; tier: string };
export function CustomerPicker({
  customers,
  value,
  onChange,
  disabled,
}: {
  customers: CustomerOption[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const selected = customers.find((customer) => customer.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Customer"
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className="w-full justify-between"
        >
          <span className="truncate">
            {selected
              ? `${selected.name} · ${selected.tier}`
              : "Choose customer"}
          </span>
          <CaretUpDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search customers"
            aria-label="Search customers"
          />
          <CommandList id={listId}>
            <CommandEmpty>No matching customers.</CommandEmpty>
            <CommandGroup>
              {customers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`${customer.name} ${customer.tier} ${customer.id}`}
                  onSelect={() => {
                    onChange(customer.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className={
                      customer.id === value ? "opacity-100" : "opacity-0"
                    }
                  />
                  {customer.name} · {customer.tier}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
