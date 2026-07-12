import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { loadEnv } from "../config/env";
import {
  authMiddleware,
  type AuthenticatedRequest,
  type AuthPayload,
} from "../middleware/auth";

const env = loadEnv();

/**
 * Supports JWT via Authorization header (API) or `token` query param (browser redirect).
 */
export function instagramAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const queryToken =
    typeof req.query.token === "string" ? req.query.token.trim() : undefined;

  if (queryToken) {
    try {
      const payload = jwt.verify(queryToken, env.JWT_SECRET) as AuthPayload;
      req.user = payload;
      next();
      return;
    } catch {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
  }

  authMiddleware(req, res, next);
}
