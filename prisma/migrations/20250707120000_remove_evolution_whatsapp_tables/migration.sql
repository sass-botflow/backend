-- Drop Evolution API session table and legacy plaintext WhatsApp integration table.
DROP TABLE IF EXISTS "WhatsAppSession";
DROP TABLE IF EXISTS "WhatsAppAccount";

DROP TYPE IF EXISTS "WhatsAppSessionStatus";
DROP TYPE IF EXISTS "WhatsAppAccountStatus";
