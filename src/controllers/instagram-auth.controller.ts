import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { loadEnv } from "../config/env";
import { renderOAuthErrorPage } from "../lib/oauth-error-page";
import type { AuthenticatedRequest } from "../middleware/auth";
import {
  getInstagramAuthorizeUrl,
  handleInstagramCallback,
  InstagramOAuthError,
  mapOAuthServiceError,
} from "../services/instagram-auth.service";

const env = loadEnv();

const callbackQuerySchema = z.object({
  code: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
  error_reason: z.string().optional(),
});

function workflowsRedirectUrl(): string {
  return new URL("/dashboard/workflows", env.FRONTEND_URL).toString();
}

function sendOAuthErrorPage(
  res: Response,
  statusCode: number,
  title: string,
  message: string,
): void {
  res.status(statusCode).type("html").send(renderOAuthErrorPage(title, message));
}

export const instagramAuthController = {
  startOAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const authorizeUrl = getInstagramAuthorizeUrl(userId);
      res.redirect(authorizeUrl);
    } catch (error) {
      next(error);
    }
  },

  async handleCallback(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const query = callbackQuerySchema.parse(req.query);

      if (query.error) {
        const description =
          query.error_description ??
          "Instagram authorization was denied or cancelled.";
        sendOAuthErrorPage(
          res,
          400,
          "Instagram connection failed",
          description,
        );
        return;
      }

      if (!query.code || !query.state) {
        sendOAuthErrorPage(
          res,
          400,
          "Instagram connection failed",
          "Missing authorization code or state. Please try connecting again.",
        );
        return;
      }

      await handleInstagramCallback(query.code, query.state);
      res.redirect(workflowsRedirectUrl());
    } catch (error) {
      const mapped = mapOAuthServiceError(error);
      sendOAuthErrorPage(
        res,
        mapped.statusCode,
        "Instagram connection failed",
        mapped.message,
      );
    }
  },
};

export function instagramAuthErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof InstagramOAuthError) {
    sendOAuthErrorPage(res, err.statusCode, "Instagram connection failed", err.message);
    return;
  }

  next(err);
}
