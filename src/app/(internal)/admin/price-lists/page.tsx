import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/layout/status-badge";
import { Percent } from "@/components/layout/money";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { PriceListFormDialog } from "./_components/price-list-form-dialog";

export const metadata = { title: "Price lists · Admin" };

export default async function PriceListsPage() {
  const user = await requireInternal();
  const lists = await prisma.priceList.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, customers: true } } },
  });
  const canManage = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        title="Price lists"
        description="A quotation line snapshots the price it was added at, so publishing a new version never moves an existing quote."
        actions={canManage ? <PriceListFormDialog /> : null}
      />

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table containerClassName="rounded-none border-0">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Overrides</TableHead>
                <TableHead className="text-right">Customers</TableHead>
                <TableHead className="text-right">Version</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <Link href={`/admin/price-lists/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    <span className="text-muted-foreground ml-2 text-xs">{l.currency}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={l.rule} />
                    {l.rule === "PERCENT_OFF_BASE" ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        <Percent bp={l.percentOffBp} /> off base
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {l.tier ? <StatusBadge value={l.tier} /> : <span className="text-muted-foreground">Any</span>}
                  </TableCell>
                  <TableCell className="tabular text-right">{l._count.items}</TableCell>
                  <TableCell className="tabular text-right">{l._count.customers}</TableCell>
                  <TableCell className="tabular text-right">v{l.version}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
