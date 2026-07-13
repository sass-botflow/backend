-- Add username login (email optional for MVP)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;

UPDATE "User"
SET "username" = LOWER(REGEXP_REPLACE(SPLIT_PART("email", '@', 1), '[^a-zA-Z0-9_]', '', 'g'))
WHERE "username" IS NULL AND "email" IS NOT NULL;

UPDATE "User"
SET "username" = 'user_' || SUBSTRING("id", 1, 8)
WHERE "username" IS NULL OR "username" = '';

-- Resolve duplicate usernames
WITH ranked AS (
  SELECT id, username,
    ROW_NUMBER() OVER (PARTITION BY username ORDER BY "createdAt") AS rn
  FROM "User"
)
UPDATE "User" u
SET "username" = u."username" || '_' || SUBSTRING(u."id", 1, 4)
FROM ranked r
WHERE u.id = r.id AND r.rn > 1;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
