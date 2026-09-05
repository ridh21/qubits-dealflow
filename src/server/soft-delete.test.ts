import { describe, expect, it } from "vitest";
import { applySoftDeleteArgs, SOFT_DELETE_MODELS } from "./soft-delete";

/** The rules are tested through the pure transform the extension delegates to. */
function run(model: string, operation: string, args: unknown) {
  return Promise.resolve(applySoftDeleteArgs(model, operation, args));
}

describe("soft delete read filter", () => {
  it("hides retired rows from every list read", async () => {
    for (const op of ["findMany", "findFirst", "count", "aggregate", "groupBy"]) {
      const out = await run("Product", op, { where: { sku: "X" } });
      expect(out.where).toEqual({ sku: "X", deletedAt: null });
    }
  });

  it("adds a where clause even when the caller passed none", async () => {
    expect((await run("Product", "findMany", {})).where).toEqual({ deletedAt: null });
  });

  it("leaves models without the column untouched", async () => {
    const out = await run("Invoice", "findMany", { where: { number: "INV-1" } });
    expect(out.where).toEqual({ number: "INV-1" });
  });

  it("lets a caller opt in to retired rows explicitly", async () => {
    const out = await run("Product", "findMany", {
      where: { deletedAt: { not: null } },
    });
    expect(out.where).toEqual({ deletedAt: { not: null } });
  });

  // Regression: nested reads are where a per-call-site approach leaks, because
  // the same field name means different models on different parents.
  it("filters a nested list relation that is soft-deletable", async () => {
    const out = await run("Quotation", "findUnique", {
      where: { id: "q1" },
      include: { lines: true },
    });
    expect((out.include as Record<string, unknown>).lines).toEqual({
      where: { deletedAt: null },
    });
  });

  it("leaves a same-named relation alone when its model is not soft-deletable", async () => {
    const out = await run("Invoice", "findUnique", {
      where: { id: "i1" },
      include: { lines: true },
    });
    expect((out.include as Record<string, unknown>).lines).toBe(true);
  });

  it("filters relation counts", async () => {
    const out = await run("Customer", "findUnique", {
      where: { id: "c1" },
      include: { _count: { select: { users: true, quotations: true } } },
    });
    const count = (out.include as Record<string, Record<string, Record<string, unknown>>>)._count;
    expect(count.select.users).toEqual({ where: { deletedAt: null } });
    expect(count.select.quotations).toBe(true);
  });

  it("keeps a to-one relation resolvable so historical rows still render", async () => {
    const out = await run("QuotationLine", "findUnique", {
      where: { id: "l1" },
      include: { product: true },
    });
    expect((out.include as Record<string, unknown>).product).toBe(true);
  });

  it("covers every model the schema marks soft-deletable", () => {
    expect(SOFT_DELETE_MODELS.length).toBe(17);
  });
});
