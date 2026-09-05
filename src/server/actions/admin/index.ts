"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireRole } from "@/server/auth/guards";
import { toActionError, type ActionResult } from "@/domain/errors";
import * as users from "@/server/services/admin/user.service";
import * as customers from "@/server/services/admin/customer.service";
import * as products from "@/server/services/admin/product.service";
import * as priceLists from "@/server/services/admin/price-list.service";
import * as warehouses from "@/server/services/admin/warehouse.service";
import { sendQueuedEmails } from "@/server/email/outbox";
import {
  AdjustStockInput,
  ApproveUserInput,
  CategoryInput,
  CustomerInput,
  InvitePortalUserInput,
  PriceListInput,
  PriceListItemInput,
  ProductInput,
  ReceiveStockInput,
  ReorderPointInput,
  ReplenishmentInput,
  SetVariantsInput,
  TeamInput,
  WarehouseInput,
} from "@/lib/zod-schemas/admin";
import type { z } from "zod";

type Form = FormData | Record<string, unknown>;

function toObject(input: Form): Record<string, unknown> {
  return input instanceof FormData ? Object.fromEntries(input) : input;
}

async function run<S extends z.ZodTypeAny, T>(
  schema: S,
  input: Form,
  fn: (data: z.infer<S>) => Promise<T>,
  paths: string[],
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(toObject(input));
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION", message: parsed.error.issues[0]?.message ?? "Check the form." },
    };
  }
  try {
    const data = await fn(parsed.data);
    for (const p of paths) revalidatePath(p);
    return { ok: true, data };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Users ──
export async function approveUserAction(input: Form) {
  const actor = await requireAdmin();
  return run(ApproveUserInput, input, (d) => users.approveUser(actor, d), ["/admin/users", "/dashboard"]);
}

export async function updateUserRoleAction(input: Form) {
  const actor = await requireAdmin();
  return run(ApproveUserInput, input, (d) => users.updateUserRole(actor, d), ["/admin/users"]);
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  const actor = await requireAdmin();
  try {
    const data = isActive
      ? await users.reactivateUser(actor, userId)
      : await users.deactivateUser(actor, userId);
    revalidatePath("/admin/users");
    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function createTeamAction(input: Form) {
  const actor = await requireAdmin();
  return run(TeamInput, input, (d) => users.createTeam(actor, d), ["/admin/users"]);
}

// ── Customers ──
export async function createCustomerAction(input: Form) {
  const actor = await requireAdmin();
  return run(CustomerInput, input, (d) => customers.createCustomer(actor, d), ["/admin/customers"]);
}

export async function updateCustomerAction(id: string, input: Form) {
  const actor = await requireAdmin();
  return run(CustomerInput, input, (d) => customers.updateCustomer(actor, id, d), [
    "/admin/customers",
    `/admin/customers/${id}`,
  ]);
}

export async function setCustomerActiveAction(id: string, isActive: boolean) {
  const actor = await requireAdmin();
  try {
    const data = await customers.setCustomerActive(actor, id, isActive);
    revalidatePath("/admin/customers");
    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function invitePortalUserAction(input: Form) {
  const actor = await requireAdmin();
  return run(InvitePortalUserInput, input, (d) => customers.invitePortalUser(actor, d), [
    "/admin/customers",
  ]);
}

// ── Catalogue ──
export async function createCategoryAction(input: Form) {
  const actor = await requireAdmin();
  return run(CategoryInput, input, (d) => products.createCategory(actor, d), ["/admin/products"]);
}

export async function createProductAction(input: Form) {
  const actor = await requireAdmin();
  return run(ProductInput, input, (d) => products.createProduct(actor, d), ["/admin/products"]);
}

export async function updateProductAction(id: string, input: Form) {
  const actor = await requireAdmin();
  return run(ProductInput, input, (d) => products.updateProduct(actor, id, d), [
    "/admin/products",
    `/admin/products/${id}`,
  ]);
}

export async function setProductStatusAction(id: string, status: "ACTIVE" | "ARCHIVED") {
  const actor = await requireAdmin();
  try {
    const data = await products.setProductStatus(actor, id, status);
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setVariantsAction(input: Form) {
  const actor = await requireAdmin();
  const parsedInput = toObject(input);
  return run(SetVariantsInput, parsedInput, (d) => products.setVariants(actor, d), [
    `/admin/products/${String(parsedInput.productId ?? "")}`,
  ]);
}

// ── Price lists ──
export async function createPriceListAction(input: Form) {
  const actor = await requireAdmin();
  return run(PriceListInput, input, (d) => priceLists.createPriceList(actor, d), [
    "/admin/price-lists",
  ]);
}

export async function updatePriceListAction(id: string, input: Form) {
  const actor = await requireAdmin();
  return run(PriceListInput, input, (d) => priceLists.updatePriceList(actor, id, d), [
    "/admin/price-lists",
    `/admin/price-lists/${id}`,
  ]);
}

export async function upsertPriceListItemAction(input: Form) {
  const actor = await requireAdmin();
  const obj = toObject(input);
  return run(PriceListItemInput, obj, (d) => priceLists.upsertPriceListItem(actor, d), [
    `/admin/price-lists/${String(obj.priceListId ?? "")}`,
  ]);
}

export async function removePriceListItemAction(itemId: string, priceListId: string) {
  const actor = await requireAdmin();
  try {
    await priceLists.removePriceListItem(actor, itemId);
    revalidatePath(`/admin/price-lists/${priceListId}`);
    return { ok: true as const, data: null };
  } catch (e) {
    return toActionError(e);
  }
}

export async function assignPriceListAction(customerId: string, priceListId: string | null) {
  const actor = await requireAdmin();
  try {
    const data = await priceLists.assignPriceListToCustomer(actor, customerId, priceListId);
    revalidatePath(`/admin/customers/${customerId}`);
    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Warehouses & stock ──
export async function createWarehouseAction(input: Form) {
  const actor = await requireAdmin();
  return run(WarehouseInput, input, (d) => warehouses.createWarehouse(actor, d), [
    "/admin/warehouses",
  ]);
}

export async function updateWarehouseAction(id: string, input: Form) {
  const actor = await requireAdmin();
  return run(WarehouseInput, input, (d) => warehouses.updateWarehouse(actor, id, d), [
    "/admin/warehouses",
    `/admin/warehouses/${id}`,
  ]);
}

export async function setWarehouseActiveAction(id: string, isActive: boolean) {
  const actor = await requireAdmin();
  try {
    const data = await warehouses.setWarehouseActive(actor, id, isActive);
    revalidatePath("/admin/warehouses");
    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}

export async function receiveStockAction(input: Form) {
  const actor = await requireRole(["ADMIN", "FINANCE"]);
  const obj = toObject(input);
  return run(ReceiveStockInput, obj, (d) => warehouses.receiveStock(actor, d), [
    `/admin/warehouses/${String(obj.warehouseId ?? "")}`,
  ]);
}

export async function adjustStockAction(input: Form) {
  const actor = await requireRole(["ADMIN", "FINANCE"]);
  const obj = toObject(input);
  return run(AdjustStockInput, obj, (d) => warehouses.adjustStock(actor, d), [
    `/admin/warehouses/${String(obj.warehouseId ?? "")}`,
  ]);
}

export async function setReorderPointAction(input: Form) {
  const actor = await requireRole(["ADMIN", "FINANCE"]);
  const obj = toObject(input);
  return run(ReorderPointInput, obj, (d) => warehouses.setReorderPoint(actor, d), [
    `/admin/warehouses/${String(obj.warehouseId ?? "")}`,
  ]);
}

export async function createReplenishmentAction(input: Form) {
  const actor = await requireRole(["ADMIN", "FINANCE"]);
  const obj = toObject(input);
  return run(ReplenishmentInput, obj, (d) => warehouses.createReplenishmentPlan(actor, d), [
    `/admin/warehouses/${String(obj.warehouseId ?? "")}`,
  ]);
}

export async function cancelReplenishmentAction(id: string, warehouseId: string) {
  const actor = await requireRole(["ADMIN", "FINANCE"]);
  try {
    const data = await warehouses.cancelReplenishmentPlan(actor, id);
    revalidatePath(`/admin/warehouses/${warehouseId}`);
    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Email outbox ──
export async function sendQueuedEmailsAction() {
  await requireAdmin();
  try {
    const data = await sendQueuedEmails(50);
    revalidatePath("/admin/emails");
    return { ok: true as const, data };
  } catch (e) {
    return toActionError(e);
  }
}
