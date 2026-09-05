import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/layout/status-badge";
import { Money } from "@/components/layout/money";
import { prisma } from "@/server/db";
import { requireInternal } from "@/server/auth/guards";
import { WarehouseFormDialog } from "./_components/warehouse-form-dialog";

export const metadata = { title: "Warehouses · Admin" };

export default async function WarehousesPage() {
  const user = await requireInternal();
  const warehouses = await prisma.warehouse.findMany({
    orderBy: [{ priority: "asc" }, { name: "asc" }],
    include: { stockLevels: true, _count: { select: { replenishments: true } } },
  });
  const canManage = user.role === "ADMIN";

  return (
    <>
      <PageHeader
        title="Warehouses"
        description="Shipping weights and the fixed cost per shipment feed the phase 06 split optimiser."
        actions={canManage ? <WarehouseFormDialog /> : null}
      />

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Table containerClassName="rounded-none border-0">
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Priority</TableHead>
                <TableHead className="text-right">Per-unit shipping</TableHead>
                <TableHead className="text-right">Fixed per shipment</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Reserved</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => {
                const onHand = w.stockLevels.reduce((a, s) => a + s.onHand, 0);
                const reserved = w.stockLevels.reduce((a, s) => a + s.reserved, 0);
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      <Link href={`/admin/warehouses/${w.id}`} className="font-medium hover:underline">
                        {w.name}
                      </Link>
                      <span className="text-muted-foreground ml-2 text-xs">{w.code}</span>
                    </TableCell>
                    <TableCell className="tabular text-right">{w.priority}</TableCell>
                    <TableCell className="text-right">
                      <Money minor={w.shippingCostWeightMinor} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money minor={w.fixedShipmentCostMinor} />
                    </TableCell>
                    <TableCell className="tabular text-right">{onHand}</TableCell>
                    <TableCell className="tabular text-right">{reserved}</TableCell>
                    <TableCell>
                      <StatusBadge value={w.isActive ? "ACTIVE" : "INACTIVE"} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
