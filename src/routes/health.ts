import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "sass-botflow-backend",
    timestamp: new Date().toISOString(),
  });
});
