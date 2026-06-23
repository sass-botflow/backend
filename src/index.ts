import "dotenv/config";
import { createApp } from "./app";
import { loadEnv } from "./config/env";
import { prisma } from "./lib/prisma";

const env = loadEnv();
const app = createApp();

async function main() {
  await prisma.$connect();

  app.listen(env.PORT, () => {
    console.log(`sass-botflow backend running on http://localhost:${env.PORT}`);
  });
}

main().catch(async (error) => {
  console.error("Failed to start server:", error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
