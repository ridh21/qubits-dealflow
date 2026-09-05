import { diffPolicy } from "@/domain/policy/diff";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { readable } from "./fields";
function display(v: unknown): string {
  if (v == null) return "Not set";
  if (typeof v === "boolean") return v ? "Enabled" : "Disabled";
  if (Array.isArray(v)) return v.map(display).join(" → ");
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, value]) => `${readable(k)}: ${display(value)}`)
      .join("; ");
  return String(v);
}
export function DiffView({
  before,
  after,
}: {
  before: unknown;
  after: unknown;
}) {
  const changes = diffPolicy(before, after);
  if (!changes.length)
    return <p className="text-sm text-muted-foreground">No changes.</p>;
  return (
    <div className="max-h-80 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Setting</TableHead>
            <TableHead>Before</TableHead>
            <TableHead>After</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changes.map((c) => (
            <TableRow key={c.path}>
              <TableCell className="whitespace-normal">
                {c.path.split(".").map(readable).join(" / ")}
              </TableCell>
              <TableCell className="whitespace-normal">
                {display(c.before)}
              </TableCell>
              <TableCell className="whitespace-normal">
                {display(c.after)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
