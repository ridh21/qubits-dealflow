import { Prisma } from "@prisma/client";

/**
 * Models carrying `deletedAt`. Keep in step with schema.prisma - a model listed
 * here without the column fails loudly on the first query rather than silently
 * returning deleted rows.
 */
export const SOFT_DELETE_MODELS = [
  "User",
  "Customer",
  "Category",
  "Product",
  "VariantAttribute",
  "PriceList",
  "PriceListItem",
  "Warehouse",
  "PlanTier",
  "SubscriptionPlan",
  "EntitlementDefinition",
  "EntitlementValue",
  "QuotationLine",
  "FulfillmentPlan",
  "Allocation",
  "Backorder",
  "BillingScheduleItem",
] as const;

const GUARDED = new Set<string>(SOFT_DELETE_MODELS);

/** Reads that must never see a retired row unless explicitly asked. */
const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

type Dict = Record<string, unknown>;

/**
 * model -> relation field -> target model, for list relations only, read from
 * Prisma's own schema metadata. Deriving it means a relation added later is
 * covered automatically instead of depending on someone remembering this file.
 *
 * Only *list* relations are filtered. A to-one relation (a line's product, a
 * plan's warehouse) must still resolve after the target is retired - that is
 * the reason rows are kept rather than deleted.
 */
const LIST_RELATIONS: Record<string, Record<string, string>> = (() => {
  const out: Record<string, Record<string, string>> = {};
  const models =
    (Prisma.dmmf as unknown as {
      datamodel: {
        models: {
          name: string;
          fields: { name: string; kind: string; isList: boolean; type: string }[];
        }[];
      };
    }).datamodel.models ?? [];
  for (const model of models) {
    for (const f of model.fields) {
      if (f.kind === "object" && f.isList && GUARDED.has(f.type)) {
        (out[model.name] ??= {})[f.name] = f.type;
      }
    }
  }
  return out;
})();

const LIVE = { deletedAt: null };

function withLiveFilter(value: unknown, target: string): unknown {
  // `field: true` carries no options, so give it some.
  if (value === true) return { where: { ...LIVE } };
  if (!value || typeof value !== "object") return value;
  const node = { ...(value as Dict) };
  const where = (node.where ?? {}) as Dict;
  if (!("deletedAt" in where)) node.where = { ...where, ...LIVE };
  return applyNested(node, target);
}

/** Walks include/select/_count of one node, filtering nested list relations. */
function applyNested(node: Dict, model: string): Dict {
  const relations = LIST_RELATIONS[model];
  if (!relations) return node;
  const out = { ...node };

  for (const key of ["include", "select"] as const) {
    const block = out[key];
    if (!block || typeof block !== "object") continue;
    const next: Dict = { ...(block as Dict) };
    for (const [field, value] of Object.entries(next)) {
      const target = relations[field];
      if (target) next[field] = withLiveFilter(value, target);
      else if (field === "_count" && value && typeof value === "object") {
        // Relation counts must exclude retired rows too.
        const countNode = { ...(value as Dict) };
        const countSelect = countNode.select;
        if (countSelect && typeof countSelect === "object") {
          const cs: Dict = { ...(countSelect as Dict) };
          for (const [cf, cv] of Object.entries(cs)) {
            const ct = relations[cf];
            if (ct) cs[cf] = withLiveFilter(cv, ct);
          }
          countNode.select = cs;
        }
        next[field] = countNode;
      }
    }
    out[key] = next;
  }
  return out;
}

/**
 * Applies `deletedAt: null` to every read of a soft-deletable model - at the
 * top level and through nested `include`/`select`/`_count`.
 *
 * Centralising this is the point: with ~170 read sites and 60+ nested relation
 * reads, per-call-site filters are a guarantee that one gets missed. A caller
 * that genuinely wants retired rows opts out with an explicit `deletedAt`.
 *
 * `findUnique` is deliberately left alone: Prisma only accepts unique fields
 * there, so the filter is not expressible, and fetching a known id is what
 * audit and restore paths depend on. Its nested relations are still filtered.
 */
/**
 * Pure args transform, exported so the filtering rules can be tested directly
 * rather than through a live client.
 */
export function applySoftDeleteArgs(
  model: string,
  operation: string,
  args: unknown,
): Dict {
  const isRead = READ_OPS.has(operation);
  const isUniqueRead =
    operation === "findUnique" || operation === "findUniqueOrThrow";
  const next = { ...((args ?? {}) as Dict) };
  if (!isRead && !isUniqueRead) return next;

  if (isRead && GUARDED.has(model)) {
    const where = (next.where ?? {}) as Dict;
    if (!("deletedAt" in where)) next.where = { ...where, ...LIVE };
  }
  return applyNested(next, model);
}

export const softDeleteExtension = Prisma.defineExtension({
  name: "soft-delete",
  query: {
    $allModels: {
      async $allOperations(params) {
        const { model, operation, args } = params;
        // `$allModels` collapses the per-model union, so the callback type is
        // widened here rather than at every use.
        const query = params.query as (a: unknown) => Promise<unknown>;
        if (!model) return query(args);
        return query(applySoftDeleteArgs(model, operation, args));
      },
    },
  },
});
