import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { portalActor, listMySubscriptions } from "@/server/queries/portal";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
export default async function SubscriptionsPage() {
  const rows = await listMySubscriptions(await portalActor());
  return (
    <>
      <PageHeader
        title="My subscriptions"
        description="Your plans, next billing dates, and pause schedules."
      />
      <Table>
        <TableHeader>
          <TableRow>
            {[
              "Plan",
              "Cycle",
              "Status",
              "Next bill",
              "Pause effective",
              "Resume",
            ].map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <Link
                  className="text-primary"
                  href={`/portal/subscriptions/${s.id}`}
                >
                  {s.orderLine.productName} · {s.plan.tier?.name ?? s.plan.name}
                </Link>
              </TableCell>
              <TableCell>{s.plan.interval.toLowerCase()}</TableCell>
              <TableCell>
                {s.status.toLowerCase().replaceAll("_", " ")}
              </TableCell>
              <TableCell>
                {s.nextBillingDate?.toLocaleDateString() ?? "—"}
              </TableCell>
              <TableCell>
                {s.pauseEffectiveAt?.toLocaleDateString() ?? "—"}
              </TableCell>
              <TableCell>{s.resumeAt?.toLocaleDateString() ?? "—"}</TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={6}>No subscriptions yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}
