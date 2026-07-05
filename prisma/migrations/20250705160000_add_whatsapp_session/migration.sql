-- CreateEnum
CREATE TYPE "WhatsAppSessionStatus" AS ENUM ('CREATED', 'CONNECTING', 'CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" UUID NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "status" "WhatsAppSessionStatus" NOT NULL DEFAULT 'CREATED',
    "engine" TEXT NOT NULL DEFAULT 'evolution',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppSession_instanceName_key" ON "WhatsAppSession"("instanceName");

-- CreateIndex
CREATE INDEX "WhatsAppSession_workspaceId_idx" ON "WhatsAppSession"("workspaceId");

-- AddForeignKey
ALTER TABLE "WhatsAppSession" ADD CONSTRAINT "WhatsAppSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
