import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { botsRouter } from "./routes/bots";
import { healthRouter } from "./routes/health";
import { workflowsRouter } from "./routes/workflows";

const env = loadEnv();

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/bots", botsRouter);
  app.use("/api/bots/:botId/workflows", workflowsRouter);

  app.use(errorHandler);

  return app;
}
