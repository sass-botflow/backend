-- CreateTable
CREATE TABLE "instagram_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "instagram_user_id" TEXT NOT NULL,
    "instagram_business_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profile_picture_url" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMP(3),
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_connections_user_id_key" ON "instagram_connections"("user_id");

-- CreateIndex
CREATE INDEX "instagram_connections_user_id_idx" ON "instagram_connections"("user_id");

-- AddForeignKey
ALTER TABLE "instagram_connections" ADD CONSTRAINT "instagram_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
