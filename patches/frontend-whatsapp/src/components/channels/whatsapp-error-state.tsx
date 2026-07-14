"use client";

import {
  AlertTriangle,
  CloudOff,
  RefreshCw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WhatsAppConnectErrorCode } from "@/lib/whatsapp/evolution-types";
import { cn } from "@/lib/utils";

const ERROR_COPY: Record<
  WhatsAppConnectErrorCode,
  { title: string; description: string; icon: typeof CloudOff }
> = {
  EVOLUTION_OFFLINE: {
    title: "Evolution API offline",
    description:
      "We couldn't reach the WhatsApp server. Check that Evolution API is running and try again.",
    icon: CloudOff,
  },
  EVOLUTION_AUTH: {
    title: "Evolution API key invalid",
    description:
      "EVOLUTION_API_KEY on the frontend must match AUTHENTICATION_API_KEY on evolution-api.",
    icon: AlertTriangle,
  },
  QR_EXPIRED: {
    title: "QR code expired",
    description: "Generating a fresh QR code automatically. Keep WhatsApp open on your phone.",
    icon: RefreshCw,
  },
  CONNECTION_LOST: {
    title: "Connection lost",
    description:
      "WhatsApp disconnected unexpectedly. Reconnect to restore automated replies.",
    icon: AlertTriangle,
  },
  ALREADY_CONNECTED: {
    title: "Already connected",
    description: "This WhatsApp number is already linked to your workspace.",
    icon: Smartphone,
  },
  NO_INTERNET: {
    title: "No internet connection",
    description: "Check your network connection and try again.",
    icon: WifiOff,
  },
  UNKNOWN: {
    title: "Something went wrong",
    description: "We couldn't complete the connection. Please try again.",
    icon: AlertTriangle,
  },
};

interface WhatsAppErrorStateProps {
  code: WhatsAppConnectErrorCode;
  detail?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function WhatsAppErrorState({
  code,
  detail,
  onRetry,
  className,
}: WhatsAppErrorStateProps) {
  const copy = ERROR_COPY[code];
  const Icon = copy.icon;

  return (
    <div
      className={cn(
        "rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
        <Icon className="h-6 w-6 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{copy.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {detail && code === "UNKNOWN" ? detail : copy.description}
      </p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-xl"
          onClick={onRetry}
        >
          Try again
        </Button>
      ) : null}
    </div>
  );
}
