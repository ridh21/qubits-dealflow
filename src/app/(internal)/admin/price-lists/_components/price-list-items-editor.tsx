"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/layout/money";
import { Plus, Trash } from "@/components/icons";
import { removePriceListItemAction, upsertPriceListItemAction } from "@/server/actions/admin";

interface Item {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  priceMinor: number;
  basePriceMinor: number;
}

export function PriceListItemsEditor({
  priceListId,
  items,
  products,
  canManage,
}: {
  priceListId: string;
  items: Item[];
  products: { id: string; name: string; sku: string; basePriceMinor: number }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      const result = await upsertPriceListItemAction({
        priceListId,
        productId,
        priceMinor: Math.round((Number(price) || 0) * 100),
      });
      if (result.ok) {
        toast.success("Price saved — the list moved to a new version.");
        setPrice("");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function remove(itemId: string) {
    startTransition(async () => {
      const result = await removePriceListItemAction(itemId, priceListId);
      if (result.ok) {
        toast.success("Override removed.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-sm font-semibold">Item prices</p>
            <p className="text-muted-foreground text-sm">
              Overrides win over the list rule for the products listed here.
            </p>
          </div>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pli-price">Price</Label>
              <Input
                id="pli-price"
                className="w-32"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="1080.00"
              />
            </div>
            <Button onClick={add} disabled={pending || !productId || !price}>
              <Plus className="size-4" /> Set price
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No item overrides on this list.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table containerClassName="rounded-none border-0">
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">List price</TableHead>
                  <TableHead className="text-right">This list</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <p className="font-medium">{i.productName}</p>
                      <p className="text-muted-foreground text-xs">{i.sku}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right">
                      <Money minor={i.basePriceMinor} />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <Money minor={i.priceMinor} />
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          onClick={() => remove(i.id)}
                          disabled={pending}
                          aria-label={`Remove ${i.productName} override`}
                        >
                          <Trash className="size-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
