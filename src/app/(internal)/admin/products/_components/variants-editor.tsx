"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash } from "@/components/icons";
import { setVariantsAction } from "@/server/actions/admin";

interface ValueDraft {
  value: string;
  extraPrice: string;
}
interface AttributeDraft {
  name: string;
  sortOrder: number;
  values: ValueDraft[];
}

export function VariantsEditor({
  productId,
  attributes,
  canManage,
}: {
  productId: string;
  attributes: AttributeDraft[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<AttributeDraft[]>(attributes);
  const [pending, startTransition] = useTransition();

  const combinations = draft.length
    ? draft.reduce((acc, a) => acc * Math.max(1, a.values.length), 1)
    : 0;

  function addAttribute() {
    setDraft((d) => [...d, { name: "", sortOrder: d.length, values: [{ value: "", extraPrice: "0" }] }]);
  }

  function update(i: number, patch: Partial<AttributeDraft>) {
    setDraft((d) => d.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function updateValue(ai: number, vi: number, patch: Partial<ValueDraft>) {
    setDraft((d) =>
      d.map((a, idx) =>
        idx === ai
          ? { ...a, values: a.values.map((v, vIdx) => (vIdx === vi ? { ...v, ...patch } : v)) }
          : a,
      ),
    );
  }

  function save() {
    startTransition(async () => {
      const result = await setVariantsAction({
        productId,
        attributes: draft
          .filter((a) => a.name.trim() && a.values.some((v) => v.value.trim()))
          .map((a, i) => ({
            name: a.name.trim(),
            sortOrder: i,
            values: a.values
              .filter((v) => v.value.trim())
              .map((v) => ({
                value: v.value.trim(),
                extraPriceMinor: Math.round((Number(v.extraPrice) || 0) * 100),
              })),
          })),
      });
      if (result.ok) {
        toast.success("Variants saved.");
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {combinations > 0
            ? `${combinations} variant combination${combinations === 1 ? "" : "s"} from ${draft.length} attribute${draft.length === 1 ? "" : "s"}.`
            : "No variants — the product is quoted at its list price."}
        </p>
        {canManage ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addAttribute}>
              <Plus className="size-4" /> Add attribute
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save variants"}
            </Button>
          </div>
        ) : null}
      </div>

      {draft.length === 0 ? (
        <Card className="shadow-none">
          <CardContent className="text-muted-foreground p-6 text-sm">
            Add an attribute such as Size or RAM, then list its values and any extra price.
          </CardContent>
        </Card>
      ) : null}

      {draft.map((attr, ai) => (
        <Card key={ai} className="shadow-none">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-end gap-3">
              <div className="w-56 space-y-2">
                <Label>Attribute</Label>
                <Input
                  value={attr.name}
                  disabled={!canManage}
                  onChange={(e) => update(ai, { name: e.target.value })}
                  placeholder="Size"
                />
              </div>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => setDraft((d) => d.filter((_, i) => i !== ai))}
                  aria-label={`Remove ${attr.name || "attribute"}`}
                >
                  <Trash className="size-4" />
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              {attr.values.map((v, vi) => (
                <div key={vi} className="flex items-center gap-3">
                  <Input
                    className="w-56"
                    value={v.value}
                    disabled={!canManage}
                    onChange={(e) => updateValue(ai, vi, { value: e.target.value })}
                    placeholder="14 inch"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">extra</span>
                    <Input
                      className="w-28"
                      inputMode="decimal"
                      value={v.extraPrice}
                      disabled={!canManage}
                      onChange={(e) => updateValue(ai, vi, { extraPrice: e.target.value })}
                    />
                  </div>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground"
                      onClick={() =>
                        update(ai, { values: attr.values.filter((_, i) => i !== vi) })
                      }
                      aria-label="Remove value"
                    >
                      <Trash className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update(ai, { values: [...attr.values, { value: "", extraPrice: "0" }] })}
                >
                  <Plus className="size-3.5" /> Add value
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
