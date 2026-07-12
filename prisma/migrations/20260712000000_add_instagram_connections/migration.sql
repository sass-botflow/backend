-- CreateTable
CREATE TABLE "instagram_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "instagram_user_id" TEXT NOT NULL,
    "instagram_business_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "profile_picture_url" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" DATETIME,
    "connected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "instagram_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "instagram_connections_user_id_key" ON "instagram_connections"("user_id");

-- CreateIndex
CREATE INDEX "instagram_connections_user_id_idx" ON "instagram_connections"("user_id");
