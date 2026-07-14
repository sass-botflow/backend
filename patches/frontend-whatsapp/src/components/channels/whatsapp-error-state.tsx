"use client";

import { AlertTriangle, CloudOff, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WhatsAppConnectErrorCode } from "@/lib/whatsapp/evolution-types";

const COPY: Record<
  WhatsAppConnectErrorCode,
  { title: string; description: string; icon: typeof CloudOff }
> = {
  BACKEND_OFFLINE: {
    title: "Backend API offline",
    description:
      "api.botflow.ink is not responding. EasyPanel → backend → Source GitHub + Dockerfile → Deploy (10 min).",
    icon: ServerCrash,
  },
  EVOLUTION_OFFLINE: {
    title: "Evolution API offline",
    description:
      "WhatsApp server is not running. EasyPanel → botflow-evolution → Start. Set EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080 on backend and frontend.",
    icon: CloudOff,
  },
  QR_EXPIRED: {
    title: "QR code expired",
    description: "Generate a new QR code and scan again within 60 seconds.",
    icon: AlertTriangle,
  },
  CONNECTION_LOST: {
    title: "Connection lost",
    description: "WhatsApp disconnected. Try connecting again.",
    icon: AlertTriangle,
  },
  ALREADY_CONNECTED: {
    title: "Already connected",
    description: "This number is already linked to BotFlow.",
    icon: AlertTriangle,
  },
  NO_INTERNET: {
    title: "Network error",
    description: "Check your internet connection and try again.",
    icon: CloudOff,
  },
  UNKNOWN: {
    title: "Something went wrong",
    description: "Could not start WhatsApp connection. Try again or check EasyPanel logs.",
    icon: AlertTriangle,
  },
};

export function WhatsAppErrorState({
  code,
  onRetry,
}: {
  code: WhatsAppConnectErrorCode;
  onRetry: () => void;
}) {
  const content = COPY[code] ?? COPY.UNKNOWN;
  const Icon = content.icon;

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
        <Icon className="h-6 w-6 text-red-400" />
      </div>
      <h4 className="font-semibold text-red-300">{content.title}</h4>
      <p className="mt-2 text-sm text-muted-foreground">{content.description}</p>
      <Button
        type="button"
        variant="outline"
        onClick={onRetry}
        className="mt-4 rounded-xl border-red-500/30"
      >
        Try again
      </Button>
    </div>
  );
}
