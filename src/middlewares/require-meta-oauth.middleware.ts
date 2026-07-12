import { NextFunction, Request, Response } from "express";
import { getMetaConfig } from "../config/meta";
import { renderOAuthErrorPage } from "../lib/oauth-error-page";

export function requireMetaOAuthConfig(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!getMetaConfig()) {
    const message =
      "Instagram OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.";

    if (req.path.endsWith("/callback")) {
      res
        .status(503)
        .type("html")
        .send(renderOAuthErrorPage("Configuration error", message));
      return;
    }

    res.status(503).json({ error: message });
    return;
  }

  next();
}
