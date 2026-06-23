import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthenticatedRequest, authMiddleware } from "../middleware/auth";

export const workflowsRouter = Router({ mergeParams: true });

workflowsRouter.use(authMiddleware);

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  trigger: z.string().min(1).max(200),
  config: z.record(z.unknown()).optional(),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  trigger: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(["INACTIVE", "ACTIVE", "ERROR"]).optional(),
});

async function getOwnedBot(botId: string, userId: string) {
  return prisma.bot.findFirst({ where: { id: botId, userId } });
}

workflowsRouter.get("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const botId = String(req.params.botId);
    const bot = await getOwnedBot(botId, req.user!.userId);

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const workflows = await prisma.workflow.findMany({
      where: { botId },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ workflows });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.post("/", async (req: AuthenticatedRequest, res, next) => {
  try {
    const botId = String(req.params.botId);
    const bot = await getOwnedBot(botId, req.user!.userId);

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const body = createWorkflowSchema.parse(req.body);

    const workflow = await prisma.workflow.create({
      data: {
        name: body.name,
        trigger: body.trigger,
        config: JSON.stringify(body.config ?? {}),
        botId,
      },
    });

    res.status(201).json({ workflow });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.patch("/:workflowId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const botId = String(req.params.botId);
    const workflowId = String(req.params.workflowId);
    const bot = await getOwnedBot(botId, req.user!.userId);

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const body = updateWorkflowSchema.parse(req.body);

    const existing = await prisma.workflow.findFirst({
      where: { id: workflowId, botId },
    });

    if (!existing) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const workflow = await prisma.workflow.update({
      where: { id: existing.id },
      data: {
        ...body,
        config: body.config ? JSON.stringify(body.config) : undefined,
      },
    });

    res.json({ workflow });
  } catch (error) {
    next(error);
  }
});

workflowsRouter.delete("/:workflowId", async (req: AuthenticatedRequest, res, next) => {
  try {
    const botId = String(req.params.botId);
    const workflowId = String(req.params.workflowId);
    const bot = await getOwnedBot(botId, req.user!.userId);

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const existing = await prisma.workflow.findFirst({
      where: { id: workflowId, botId },
    });

    if (!existing) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    await prisma.workflow.delete({ where: { id: existing.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
