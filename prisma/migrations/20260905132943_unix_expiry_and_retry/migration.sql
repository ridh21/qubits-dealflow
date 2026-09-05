-- EmailMessage: 0 means "eligible now", which is correct for existing rows.
ALTER TABLE "EmailMessage" ADD COLUMN "nextAttemptUnix" BIGINT NOT NULL DEFAULT 0;

-- VerificationToken: add nullable, backfill from the existing timestamp, then
-- enforce NOT NULL. Adding it as required outright would fail on live rows.
ALTER TABLE "VerificationToken" ADD COLUMN "expiresAtUnix" BIGINT;

UPDATE "VerificationToken"
SET "expiresAtUnix" = (EXTRACT(EPOCH FROM "expires") * 1000)::BIGINT;

ALTER TABLE "VerificationToken" ALTER COLUMN "expiresAtUnix" SET NOT NULL;

-- CreateIndex
CREATE INDEX "EmailMessage_status_nextAttemptUnix_idx" ON "EmailMessage"("status", "nextAttemptUnix");

-- CreateIndex
CREATE INDEX "VerificationToken_purpose_expiresAtUnix_idx" ON "VerificationToken"("purpose", "expiresAtUnix");
