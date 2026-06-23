import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, authMiddleware } from "../middleware/auth";

export const botsRouter = Router();

botsRouter.use(authMiddleware);

const createBotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateBotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
});

botsRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const bots = await prisma.bot.findMany({
      where: { userId: req.user!.userId },
      include: { workflows: true },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ bots });
  } catch (error) {
    next(error);
  }
});

botsRouter.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = createBotSchema.parse(req.body);

    const bot = await prisma.bot.create({
      data: {
        name: body.name,
        description: body.description,
        userId: req.user!.userId,
      },
    });

    res.status(201).json({ bot });
  } catch (error) {
    next(error);
  }
});

botsRouter.get("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const bot = await prisma.bot.findFirst({
      where: { id, userId: req.user!.userId },
      include: { workflows: true },
    });

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    res.json({ bot });
  } catch (error) {
    next(error);
  }
});

botsRouter.patch("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const body = updateBotSchema.parse(req.body);

    const existing = await prisma.bot.findFirst({
      where: { id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const bot = await prisma.bot.update({
      where: { id: existing.id },
      data: body,
    });

    res.json({ bot });
  } catch (error) {
    next(error);
  }
});

botsRouter.delete("/:id", async (req: AuthenticatedRequest, res, next) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.bot.findFirst({
      where: { id, userId: req.user!.userId },
    });

    if (!existing) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    await prisma.bot.delete({ where: { id: existing.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
