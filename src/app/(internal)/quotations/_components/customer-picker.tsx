"use client";
import { useEffect, useId, useState } from "react";
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
import { searchCustomersAction } from "../_actions/search-customers";

export type CustomerOption = { id: string; name: string; tier: string };

/**
 * Searches customers as you type instead of receiving the whole list.
 *
 * The page used to preload every active customer just to fill this dropdown,
 * which is a full table read on every quotation view and grows without bound.
 * `selected` carries the current customer so the closed field can render its
 * name without fetching anything.
 */
export function CustomerPicker({
  selected,
  value,
  onChange,
  disabled,
  id,
  invalid,
  errorId,
}: {
  selected?: CustomerOption | null;
  value: string;
  onChange: (customer: CustomerOption) => void;
  disabled: boolean;
  id?: string;
  invalid?: boolean;
  errorId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const listId = useId();

  const term = query.trim();

  useEffect(() => {
    // Nothing is fetched until there is something to search for: opening the
    // dropdown on its own must not hit the database.
    if (!open || !term) return;
    let cancelled = false;
    // Debounced so a fast typist issues one query, not one per keystroke.
    // State is set inside the callback: a synchronous setState in an effect
    // body cascades an extra render.
    const timer = setTimeout(async () => {
      setLoading(true);
      const rows = await searchCustomersAction(term);
      if (cancelled) return;
      setResults(rows);
      setLoading(false);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, term]);

  // Derived rather than cleared in an effect, so results never linger from a
  // previous term after the box is emptied.
  const visible = term ? results : [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-label="Customer"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          disabled={disabled}
          className="w-full justify-between"
        >
          {selected ? (
            <span className="truncate">
              {selected.name} · {selected.tier}
            </span>
          ) : (
            <span className="text-muted-foreground truncate">
              Search customers…
            </span>
          )}
          <CaretUpDown aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {/* Filtering happens server-side, so cmdk must not also filter. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search customers"
            aria-label="Search customers"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList id={listId}>
            <CommandEmpty>
              {!term
                ? "Start typing to search customers."
                : loading
                  ? "Searching…"
                  : "No matching customers."}
            </CommandEmpty>
            <CommandGroup>
              {visible.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={customer.id}
                  onSelect={() => {
                    onChange(customer);
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
