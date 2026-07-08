-- CreateEnum
CREATE TYPE "WhatsappSessionStatus" AS ENUM ('WAITING_QR', 'CONNECTING', 'CONNECTED', 'DISCONNECTED');

-- CreateTable
CREATE TABLE "WhatsappSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instanceName" TEXT NOT NULL,
    "phone" TEXT,
    "profileName" TEXT,
    "status" "WhatsappSessionStatus" NOT NULL DEFAULT 'WAITING_QR',
    "qrCode" TEXT,
    "connectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappSession_userId_key" ON "WhatsappSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappSession_instanceName_key" ON "WhatsappSession"("instanceName");

-- CreateIndex
CREATE INDEX "WhatsappSession_instanceName_idx" ON "WhatsappSession"("instanceName");

-- AddForeignKey
ALTER TABLE "WhatsappSession" ADD CONSTRAINT "WhatsappSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
