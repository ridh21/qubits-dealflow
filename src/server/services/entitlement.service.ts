import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma, withTx, type Tx } from "@/server/db";
import type { SessionUser } from "@/server/auth/guards";
import { Conflict, NotFound, ValidationError } from "@/domain/errors";
import {
  effectiveMatrix,
  type Interval,
} from "@/domain/entitlements/effective";
import {
  diffEntitlements,
  groupChangesForNotices,
} from "@/domain/entitlements/diff";
import { renderNotice } from "@/domain/entitlements/notice-text";
import { queueEmail } from "@/server/email/outbox";
import { emit } from "@/server/events";
import {
  assertPlanAdmin,
  auditCatalogue,
  CycleInput,
  lockProduct,
  parseInput,
} from "./plan-catalog.service";

export const DefinitionInput = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]*$/)
    .max(100),
  label: z.string().trim().min(1).max(150),
  unit: z.string().trim().max(80).nullable().default(null),
  per: z.enum(["DAY", "WEEK", "MONTH", "CYCLE"]),
  valueType: z.enum(["INT", "BOOL", "TEXT"]),
  sortOrder: z.number().int().min(0).max(10000).default(0),
});
const Definition = DefinitionInput.extend({ id: z.string().min(1) });
const Value = z.object({
  definitionId: z.string(),
  tierId: z.string(),
  interval: CycleInput.nullable(),
  value: z.union([
    z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    z.boolean(),
    z.string().max(2000),
  ]),
});
export const EntitlementDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.string(),
    baseHash: z.string(),
    definitions: z.array(Definition),
    values: z.array(Value),
  })
  .strict();
export type EntitlementDraft = z.infer<typeof EntitlementDraftSchema>;
const draftKey = (id: string) => `entitlementDraft:${id}`;
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function loadEntitlementState(tx: Tx, productId: string) {
  const [definitions, values, tiers, setting] = await Promise.all([
    tx.entitlementDefinition.findMany({
      where: { productId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    tx.entitlementValue.findMany({
      where: { definition: { productId } },
      orderBy: { id: "asc" },
    }),
    tx.planTier.findMany({
      where: { productId },
      orderBy: [{ rank: "asc" }, { id: "asc" }],
    }),
    tx.setting.findUnique({ where: { key: draftKey(productId) } }),
  ]);
  const base = {
    definitions: definitions.map((d) => Definition.parse(d)),
    values: values.map((v) => Value.parse(v)),
  };
  const baseHash = hash(base);
  const draft: EntitlementDraft = setting
    ? parseInput(EntitlementDraftSchema, setting.value)
    : { schemaVersion: 1, revision: randomUUID(), baseHash, ...base };
  return { ...base, tiers, draft, hasDraft: !!setting, baseHash };
}
export function validateEntitlementDraft(
  draft: EntitlementDraft,
  tierIds: string[],
) {
  const keys = new Set<string>(),
    ids = new Set<string>(),
    cells = new Set<string>();
  for (const def of draft.definitions) {
    if (keys.has(def.key) || ids.has(def.id))
      throw new ValidationError("Entitlement keys must be unique.");
    keys.add(def.key);
    ids.add(def.id);
  }
  for (const value of draft.values) {
    const def = draft.definitions.find((d) => d.id === value.definitionId);
    if (!def || !tierIds.includes(value.tierId))
      throw new ValidationError(
        "An entitlement or tier no longer belongs to this product.",
      );
    const key = JSON.stringify([
      value.definitionId,
      value.tierId,
      value.interval,
    ]);
    if (cells.has(key))
      throw new ValidationError("Duplicate entitlement cell.");
    cells.add(key);
    if (
      (def.valueType === "INT" &&
        (typeof value.value !== "number" ||
          !Number.isSafeInteger(value.value) ||
          value.value < 0)) ||
      (def.valueType === "BOOL" && typeof value.value !== "boolean") ||
      (def.valueType === "TEXT" && typeof value.value !== "string")
    )
      throw new ValidationError(
        `${def.label} needs a ${def.valueType.toLowerCase()} value.`,
      );
  }
}
async function editDraft(
  actor: SessionUser,
  productId: string,
  edit: (draft: EntitlementDraft) => void,
) {
  assertPlanAdmin(actor);
  return withTx(async (tx) => {
    await lockProduct(tx, productId);
    const state = await loadEntitlementState(tx, productId);
    if (state.draft.baseHash !== state.baseHash)
      throw new Conflict(
        "Published entitlements changed. Discard the stale draft and start again.",
      );
    const before = structuredClone(state.draft);
    edit(state.draft);
    state.draft.revision = randomUUID();
    const draft = parseInput(EntitlementDraftSchema, state.draft);
    validateEntitlementDraft(
      draft,
      state.tiers.map((t) => t.id),
    );
    await tx.setting.upsert({
      where: { key: draftKey(productId) },
      update: { value: draft },
      create: { key: draftKey(productId), value: draft },
    });
    await auditCatalogue(
      tx,
      actor,
      "Product",
      productId,
      "ENTITLEMENTS.DRAFTED",
      before,
      draft,
    );
    return draft;
  });
}
export async function defineEntitlement(
  actor: SessionUser,
  productId: string,
  input: z.input<typeof DefinitionInput>,
) {
  const data = parseInput(DefinitionInput, input);
  const id = randomUUID();
  await editDraft(actor, productId, (d) => {
    d.definitions.push({ ...data, id });
  });
  return { id };
}
export async function updateEntitlementDefinition(
  actor: SessionUser,
  productId: string,
  definitionId: string,
  input: z.input<typeof DefinitionInput>,
) {
  const data = parseInput(DefinitionInput, input);
  return editDraft(actor, productId, (d) => {
    const index = d.definitions.findIndex((v) => v.id === definitionId);
    if (index < 0) throw new NotFound("Entitlement not found.");
    const previous = d.definitions[index];
    if (
      previous.key !== data.key ||
      previous.valueType !== data.valueType ||
      previous.per !== data.per ||
      previous.unit !== data.unit
    )
      throw new ValidationError(
        "Key, type, unit and period are fixed. Archive this entitlement and define a new one to change its meaning.",
      );
    d.definitions[index] = { ...data, id: definitionId };
  });
}
export async function archiveEntitlement(
  actor: SessionUser,
  productId: string,
  definitionId: string,
) {
  return editDraft(actor, productId, (d) => {
    if (!d.definitions.some((v) => v.id === definitionId))
      throw new NotFound("Entitlement not found.");
    d.definitions = d.definitions.filter((v) => v.id !== definitionId);
    d.values = d.values.filter((v) => v.definitionId !== definitionId);
  });
}
async function setValue(
  actor: SessionUser,
  definitionId: string,
  tierId: string,
  interval: Interval | null,
  value: unknown,
  reset = false,
) {
  assertPlanAdmin(actor);
  const tier = await prisma.planTier.findUnique({ where: { id: tierId } });
  if (!tier) throw new NotFound("Tier not found.");
  return editDraft(actor, tier.productId, (d) => {
    if (!d.definitions.some((v) => v.id === definitionId))
      throw new NotFound("Entitlement not found.");
    d.values = d.values.filter(
      (v) =>
        !(
          v.definitionId === definitionId &&
          v.tierId === tierId &&
          v.interval === interval
        ),
    );
    if (!reset)
      d.values.push(
        parseInput(Value, { definitionId, tierId, interval, value }),
      );
  });
}
export async function setTierDefault(
  actor: SessionUser,
  definitionId: string,
  tierId: string,
  value: unknown,
) {
  return setValue(actor, definitionId, tierId, null, value);
}
export async function setOverride(
  actor: SessionUser,
  definitionId: string,
  tierId: string,
  interval: Interval,
  value: unknown,
) {
  parseInput(CycleInput, interval);
  return setValue(actor, definitionId, tierId, interval, value);
}
export async function resetOverride(
  actor: SessionUser,
  definitionId: string,
  tierId: string,
  interval: Interval,
) {
  parseInput(CycleInput, interval);
  return setValue(actor, definitionId, tierId, interval, undefined, true);
}
export async function discardEntitlementDraft(
  actor: SessionUser,
  productId: string,
) {
  assertPlanAdmin(actor);
  return withTx(async (tx) => {
    await lockProduct(tx, productId);
    const before = await tx.setting.findUnique({
      where: { key: draftKey(productId) },
    });
    await tx.setting.deleteMany({ where: { key: draftKey(productId) } });
    await auditCatalogue(
      tx,
      actor,
      "Product",
      productId,
      "ENTITLEMENTS.DISCARDED",
      before?.value,
      null,
    );
  });
}
async function preparePublish(tx: Tx, productId: string) {
  const product = await lockProduct(tx, productId),
    state = await loadEntitlementState(tx, productId);
  if (!state.hasDraft)
    throw new ValidationError("There is no draft to publish.");
  if (state.baseHash !== state.draft.baseHash)
    throw new Conflict(
      "Published entitlements changed. Discard this stale draft.",
    );
  validateEntitlementDraft(
    state.draft,
    state.tiers.map((t) => t.id),
  );
  const before = effectiveMatrix(
    state.definitions,
    state.tiers.map((t) => t.id),
    state.values,
  );
  const after = effectiveMatrix(
    state.draft.definitions,
    state.tiers.map((t) => t.id),
    state.draft.values,
  );
  const changes = diffEntitlements(before, after);
  const groups = groupChangesForNotices(changes);
  const notices = [];
  for (const group of groups) {
    const holders = await tx.subscription.findMany({
      where: {
        plan: {
          tierId: group.tierId,
          ...(group.interval ? { interval: group.interval } : {}),
        },
        status: { in: ["SCHEDULED", "ACTIVE", "PAUSE_SCHEDULED", "PAUSED"] },
      },
      include: {
        customer: {
          include: { users: { where: { role: "CUSTOMER", isActive: true } } },
        },
      },
    });
    const tierName = state.tiers.find((t) => t.id === group.tierId)!.name;
    const messages = holders.flatMap((sub) => {
      const addresses = [
        ...new Set(
          [sub.customer.email, ...sub.customer.users.map((u) => u.email)]
            .filter((e): e is string => !!e)
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
        ),
      ];
      if (!addresses.length)
        throw new ValidationError(
          `${sub.customer.name} has no recipient email. Add an email before publishing.`,
        );
      const content = renderNotice({
        ...group,
        productName: product.name,
        tierName,
        customerName: sub.customer.name,
        nextBoundary:
          sub.currentPeriodEnd ?? sub.resumeAt ?? sub.activationDate,
      });
      return addresses.map((to) => ({
        to,
        toName: sub.customer.name,
        ...content,
      }));
    });
    const sample =
      messages[0] ??
      renderNotice({
        ...group,
        productName: product.name,
        tierName,
        customerName: "Customer",
        nextBoundary: new Date(),
      });
    notices.push({
      ...group,
      tierName,
      recipients: messages.length,
      holders: holders.length,
      sample: { subject: sample.subject, text: sample.text },
      messages,
    });
  }
  return { state, changes, notices };
}
export async function previewPublish(actor: SessionUser, productId: string) {
  assertPlanAdmin(actor);
  return withTx(
    async (tx) => {
      const p = await preparePublish(tx, productId);
      return {
        revision: p.state.draft.revision,
        changes: p.changes,
        notices: p.notices.map((n) => ({
          tierId: n.tierId,
          interval: n.interval,
          changes: n.changes,
          tierName: n.tierName,
          recipients: n.recipients,
          holders: n.holders,
          sample: n.sample,
        })),
      };
    },
    { timeout: process.env.TEST_DATABASE_URL ? 120_000 : 30_000 },
  );
}
export async function publishChanges(
  actor: SessionUser,
  productId: string,
  reason: string,
  expectedRevision: string,
) {
  assertPlanAdmin(actor);
  reason = parseInput(z.string().trim().min(1).max(1000), reason);
  const result = await withTx(
    async (tx) => {
      const { state, changes, notices } = await preparePublish(tx, productId);
      if (state.draft.revision !== expectedRevision)
        throw new Conflict(
          "The draft changed. Preview again before publishing.",
        );
      // Replacing values also avoids PostgreSQL's nullable composite-unique default-row ambiguity.
      await tx.entitlementValue.deleteMany({
        where: { definition: { productId } },
      });
      await tx.entitlementDefinition.deleteMany({
        where: {
          productId,
          id: { notIn: state.draft.definitions.map((d) => d.id) },
        },
      });
      for (const def of state.draft.definitions)
        await tx.entitlementDefinition.upsert({
          where: { id: def.id },
          update: { ...def, productId },
          create: { ...def, productId },
        });
      if (state.draft.values.length)
        await tx.entitlementValue.createMany({
          data: state.draft.values.map((v) => ({
            ...v,
            updatedById: actor.id,
          })),
        });
      const noticeIds: string[] = [];
      let emailsQueued = 0;
      for (const notice of notices) {
        const row = await tx.planChangeNotice.create({
          data: {
            productId,
            tierId: notice.tierId,
            interval: notice.interval,
            changes: JSON.parse(JSON.stringify(notice.changes)),
            publishedById: actor.id,
            recipientCount: notice.recipients,
          },
        });
        noticeIds.push(row.id);
        for (const message of notice.messages) {
          await queueEmail(tx, {
            ...message,
            relatedType: "PlanChangeNotice",
            relatedId: row.id,
          });
          emailsQueued++;
        }
      }
      await tx.setting.delete({ where: { key: draftKey(productId) } });
      await auditCatalogue(
        tx,
        actor,
        "Product",
        productId,
        "ENTITLEMENTS.PUBLISHED",
        { definitions: state.definitions, values: state.values },
        { draft: state.draft, changes, noticeIds, emailsQueued },
        reason,
      );
      return { noticeIds, emailsQueued };
    },
    { timeout: process.env.TEST_DATABASE_URL ? 120_000 : 30_000 },
  );
  for (const noticeId of result.noticeIds)
    await emit("plan.changed", { noticeId });
  return result;
}
