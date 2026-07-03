-- Create dedicated Channel table for production multi-tenant WhatsApp connections.
-- Migrates existing WhatsApp rows from ChannelConnection while preserving IDs for Conversation FKs.

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT,
    "businessName" TEXT,
    "encryptedAccessToken" TEXT,
    "status" "ChannelStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Channel_phoneNumberId_key" ON "Channel"("phoneNumberId");

-- CreateIndex
CREATE INDEX "Channel_workspaceId_idx" ON "Channel"("workspaceId");

-- CreateIndex
CREATE INDEX "Channel_provider_idx" ON "Channel"("provider");

-- CreateIndex
CREATE INDEX "Channel_phoneNumberId_idx" ON "Channel"("phoneNumberId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate WhatsApp channel data (preserve IDs so Conversation.channelId remains valid)
INSERT INTO "Channel" (
    "id",
    "workspaceId",
    "provider",
    "businessId",
    "wabaId",
    "phoneNumberId",
    "displayPhoneNumber",
    "businessName",
    "encryptedAccessToken",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "organizationId",
    COALESCE("provider", 'whatsapp'),
    COALESCE("businessId", ''),
    COALESCE("wabaId", ''),
    "phoneNumberId",
    "displayPhoneNumber",
    "businessName",
    "encryptedAccessToken",
    "status",
    "createdAt",
    "updatedAt"
FROM "ChannelConnection"
WHERE "type" = 'WHATSAPP'
  AND "phoneNumberId" IS NOT NULL
ON CONFLICT ("phoneNumberId") DO NOTHING;

-- Clear conversation links that still point at non-WhatsApp legacy channel connections
UPDATE "Conversation"
SET "channelId" = NULL
WHERE "channelId" IS NOT NULL
  AND "channelId" NOT IN (SELECT "id" FROM "Channel");

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_channelId_fkey";

-- DropIndex
DROP INDEX "ChannelConnection_wabaId_idx";

-- DropIndex
DROP INDEX "ChannelConnection_organizationId_phoneNumberId_key";

-- DropIndex
DROP INDEX "ChannelConnection_phoneNumberId_key";

-- AlterTable
ALTER TABLE "ChannelConnection" DROP COLUMN "businessId",
DROP COLUMN "businessName",
DROP COLUMN "connectedAt",
DROP COLUMN "displayPhoneNumber",
DROP COLUMN "encryptedAccessToken",
DROP COLUMN "phoneNumberId",
DROP COLUMN "provider",
DROP COLUMN "tokenExpiresAt",
DROP COLUMN "wabaId";

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
