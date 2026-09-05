"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  quotationListHref,
  quotationSorts,
  quotationStatuses,
  type QuotationListParams,
} from "@/domain/quotation/list-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/forms/date-picker";
import { Funnel } from "@/components/icons";

type Option = { id: string; name: string };
function Choice({
  name,
  label,
  initial,
  options,
}: {
  name: string;
  label: string;
  initial?: string;
  options: Option[];
}) {
  const [value, setValue] = useState(initial || "__all__");
  return (
    <div className="space-y-1">
      <label htmlFor={`filter-${name}`} className="text-xs font-medium">
        {label}
      </label>
      <input
        type="hidden"
        name={name}
        value={value === "__all__" ? "" : value}
      />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id={`filter-${name}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All</SelectItem>
          {initial && !options.some((o) => o.id === initial) && (
            <SelectItem value={initial}>
              Selected value (unavailable)
            </SelectItem>
          )}
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
function DateField({
  name,
  label,
  initial,
}: {
  name: string;
  label: string;
  initial?: string;
}) {
  const [date, setDate] = useState<Date | undefined>(
    initial ? new Date(`${initial}T12:00:00`) : undefined,
  );
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium">{label}</span>
      <input
        type="hidden"
        name={name}
        value={date ? format(date, "yyyy-MM-dd") : ""}
      />
      {/* The filter panel supplies its own compact label above, so the picker
          keeps the name only as its accessible name. */}
      <DatePicker label={label} value={date} onChange={setDate} hideLabel />
    </div>
  );
}
const labels: Record<string, string> = {
  updatedAt: "Updated",
  createdAt: "Created",
  number: "Quotation number",
  totalMinor: "Initial total",
  oneTimeNetMinor: "One-time net",
  status: "Status",
  riskBand: "Risk",
  customer: "Customer",
  owner: "Owner",
};
export function QuotationListFilters({
  params,
  options,
  raw,
}: {
  params: QuotationListParams;
  options: { owners: Option[]; teams: Option[]; customers: Option[] };
  raw: Record<string, string | string[] | undefined>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Record<string, string[]> = {};
    for (const [key, value] of data.entries())
      if (typeof value === "string" && value.trim())
        (next[key] ??= []).push(value.trim());
    startTransition(() =>
      router.push(quotationListHref(next, { page: "1" }), { scroll: false }),
    );
  }
  const rawText = (key: string) =>
    typeof raw[key] === "string" ? raw[key] : "";
  return (
    <form
      onSubmit={submit}
      aria-label="Quotation filters"
      aria-busy={pending}
      className="space-y-4 rounded-xl border p-4"
    >
      <input type="hidden" name="view" value={params.view} />
      <input type="hidden" name="pageSize" value={params.pageSize} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="quote-search">
            Search
          </label>
          <Input
            id="quote-search"
            name="q"
            defaultValue={rawText("q")}
            placeholder="Number or customer"
            maxLength={200}
          />
        </div>
        <Choice
          name="ownerId"
          label="Owner"
          initial={params.ownerId}
          options={options.owners}
        />
        <Choice
          name="teamId"
          label="Team"
          initial={params.teamId}
          options={options.teams}
        />
        <Choice
          name="customerId"
          label="Customer"
          initial={params.customerId}
          options={options.customers}
        />
        <Choice
          name="riskBand"
          label="Risk band"
          initial={params.riskBand}
          options={["LOW", "MEDIUM", "HIGH"].map((id) => ({ id, name: id }))}
        />
        <Choice
          name="hasOpenProposals"
          label="Open customer proposals"
          initial={params.hasOpenProposals}
          options={[
            { id: "true", name: "Has open proposals" },
            { id: "false", name: "No open proposals" },
          ]}
        />
        {[
          ["minAmount", "Minimum initial total"],
          ["maxAmount", "Maximum initial total"],
        ].map(([name, label]) => (
          <div key={name} className="space-y-1">
            <label className="text-xs font-medium" htmlFor={name}>
              {label}
            </label>
            <Input
              id={name}
              name={name}
              type="number"
              min="0"
              max="21474836.47"
              step="0.01"
              defaultValue={rawText(name)}
              placeholder="Any amount"
            />
          </div>
        ))}
        <DateField
          name="createdFrom"
          label="Created from (UTC)"
          initial={params.createdFrom}
        />
        <DateField
          name="createdTo"
          label="Created through (UTC)"
          initial={params.createdTo}
        />
        <Choice
          name="sort"
          label="Sort by"
          initial={params.sort}
          options={quotationSorts.map((id) => ({ id, name: labels[id] }))}
        />
        <Choice
          name="dir"
          label="Sort direction"
          initial={params.dir}
          options={[
            { id: "desc", name: "Descending" },
            { id: "asc", name: "Ascending" },
          ]}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">
          Statuses (any selected; none means all)
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {quotationStatuses.map((status) => (
            <label key={status} className="flex items-center gap-2 text-xs">
              <Checkbox
                name="status"
                value={status}
                defaultChecked={params.status.includes(status)}
              />
              {status.replaceAll("_", " ").toLowerCase()}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Amounts use each quotation’s currency, without conversion. Initial total
        includes tax and the first recurring period; one-time net remains
        separate.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          <Funnel className="size-4" />
          {pending ? "Applying…" : "Apply filters"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(() =>
              router.push(quotationListHref({}, { view: params.view }), {
                scroll: false,
              }),
            )
          }
        >
          Clear filters
        </Button>
      </div>
    </form>
  );
}
