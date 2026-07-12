import cors from "cors";
import express from "express";
import helmet from "helmet";
import { loadEnv, parseCorsOrigins } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { botsRouter } from "./routes/bots";
import { healthRouter } from "./routes/health";
import { instagramAuthRouter } from "./routes/instagram-auth.routes";
import { workflowsRouter } from "./routes/workflows";

const env = loadEnv();

export function createApp() {
  const app = express();

  app.use(helmet());
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  app.use("/health", healthRouter);
  app.use("/api/auth", instagramAuthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/bots", botsRouter);
  app.use("/api/bots/:botId/workflows", workflowsRouter);

  app.use(errorHandler);

  return app;
}
