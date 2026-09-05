-- DropIndex
DROP INDEX "EntitlementDefinition_productId_key_key";

-- DropIndex
DROP INDEX "EntitlementValue_definitionId_tierId_interval_key";

-- These two tables are rebuilt in place on every entitlement publish, so a
-- plain unique would collide with the rows we just soft-deleted. Uniqueness
-- must therefore apply to live rows only. Prisma cannot express a partial
-- index, so it is managed here and intentionally absent from schema.prisma.
CREATE UNIQUE INDEX "EntitlementDefinition_productId_key_live"
  ON "EntitlementDefinition"("productId", "key")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "EntitlementValue_definitionId_tierId_interval_live"
  ON "EntitlementValue"("definitionId", "tierId", "interval")
  WHERE "deletedAt" IS NULL;
