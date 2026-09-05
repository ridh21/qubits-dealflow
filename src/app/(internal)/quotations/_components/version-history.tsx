"use client";
import { useState } from "react";
import { formatDateTimeIST } from "@/lib/datetime-ist";
import type { QuotationVersion } from "@prisma/client";
import { quotationSnapshotDiff } from "./quotation-snapshot-diff";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function VersionHistory({
  versions,
  open,
  onOpenChange,
  actorNames,
  customerNames = {},
}: {
  versions: QuotationVersion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actorNames: Record<string, string>;
  customerNames?: Record<string, string>;
}) {
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const ordered = [...versions].sort((a, b) => b.version - a.version);
  const selected =
    ordered.find((version) => String(version.version) === selectedVersion) ??
    ordered[0];
  const previous = selected
    ? ordered[ordered.indexOf(selected) + 1]
    : undefined;
  const diff = selected
    ? quotationSnapshotDiff(
        previous ? previous.snapshot : {},
        selected.snapshot,
        customerNames,
      )
    : null;
  const author = selected?.createdById
    ? (actorNames[selected.createdById] ??
      `${selected.createdByType === "CUSTOMER" ? "Customer" : "Team member"} (${selected.createdById})`)
    : selected?.createdByType === "SYSTEM"
      ? "System"
      : "Author not recorded";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            Saved terms, pricing and approval changes compared with the previous
            recorded snapshot.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5 p-4">
          {!selected ? (
            <p>No saved versions yet.</p>
          ) : (
            <>
              <Select
                value={String(selected.version)}
                onValueChange={setSelectedVersion}
              >
                <SelectTrigger aria-label="Snapshot version">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ordered.map((version) => (
                    <SelectItem
                      key={version.id}
                      value={String(version.version)}
                    >
                      v{version.version} · {version.reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <h3 className="font-medium">
                  v{selected.version} · {selected.reason}
                </h3>
                <p className="text-sm text-muted-foreground">
                  By {author} ·{" "}
                  <time dateTime={new Date(selected.createdAt).toISOString()}>
                    {formatDateTimeIST(new Date(selected.createdAt))}
                  </time>
                </p>
                <p className="text-sm">
                  {previous
                    ? `Compared with v${previous.version}`
                    : "Initial snapshot · no earlier version"}
                </p>
              </div>
              {!diff?.available ? (
                <p role="status">
                  Snapshot data is unavailable. This version cannot be compared
                  safely.
                </p>
              ) : !diff.changes.length ? (
                <p>No terms, pricing or approval changes in this snapshot.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Changed field</TableHead>
                      <TableHead>
                        {previous ? `Before · v${previous.version}` : "Before"}
                      </TableHead>
                      <TableHead>After · v{selected.version}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.changes.map((change) => (
                      <TableRow key={change.path}>
                        <TableCell className="whitespace-normal align-top">
                          <span className="text-xs text-muted-foreground">
                            {change.section}
                          </span>
                          <p className="font-medium">{change.field}</p>
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-pre-wrap break-words align-top">
                          {change.before}
                        </TableCell>
                        <TableCell className="max-w-72 whitespace-pre-wrap break-words align-top">
                          {change.after}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
