import { Router } from "express";
import {
  instagramAuthController,
  instagramAuthErrorHandler,
} from "../controllers/instagram-auth.controller";
import { instagramAuthMiddleware } from "../middlewares/instagram-auth.middleware";
import { requireMetaOAuthConfig } from "../middlewares/require-meta-oauth.middleware";

export const instagramAuthRouter = Router();

instagramAuthRouter.use(requireMetaOAuthConfig);

instagramAuthRouter.get(
  "/instagram",
  instagramAuthMiddleware,
  instagramAuthController.startOAuth,
);

instagramAuthRouter.get("/instagram/callback", instagramAuthController.handleCallback);

instagramAuthRouter.use(instagramAuthErrorHandler);
