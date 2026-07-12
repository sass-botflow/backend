"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Instagram, Loader2, Unplug } from "lucide-react";
import { AppBanner } from "@/components/ui/app-banner";
import { Button } from "@/components/ui/button";

export interface InstagramChannel {
  id: string;
  provider: "instagram";
  status: "CONNECTED";
  username: string;
  businessName: string;
  avatarUrl?: string | null;
  profilePictureUrl?: string | null;
  connectedAt?: string | null;
}

const QUERY_KEY = ["instagram-channel"] as const;

async function fetchInstagramChannel(): Promise<InstagramChannel | null> {
  const response = await fetch("/api/channels/instagram", { cache: "no-store" });
  const body = (await response.json()) as {
    connected?: boolean;
    channel?: InstagramChannel | null;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.error ?? "Failed to load Instagram connection.");
  }

  return body.channel ?? null;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("token") ??
    localStorage.getItem("auth_token") ??
    localStorage.getItem("botflow_token")
  );
}

function openInstagramOAuthPopup(): void {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Please log in before connecting Instagram.");
  }

  const url = new URL("/api/auth/instagram", window.location.origin);
  url.searchParams.set("token", token);
  url.searchParams.set("popup", "1");
  url.searchParams.set("flow", "instagram");

  const width = 520;
  const height = 720;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    url.toString(),
    "botflow-instagram-oauth",
    `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`,
  );

  if (!popup) {
    throw new Error("Popup blocked. Allow popups for BotFlow and try again.");
  }
}

export function useInstagramChannel() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchInstagramChannel,
  });
}

export function InstagramChannelsSection() {
  const queryClient = useQueryClient();
  const channelQuery = useInstagramChannel();
  const [banner, setBanner] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/channels/instagram", { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not disconnect Instagram.");
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(QUERY_KEY, null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setBanner({ message: "Instagram disconnected.", variant: "success" });
    },
    onError: (error: Error) => {
      setBanner({ message: error.message, variant: "error" });
    },
  });

  const handleConnected = useCallback(
    (payload: { username?: string; profilePictureUrl?: string | null }) => {
      setConnecting(false);
      setBanner({
        message: payload.username
          ? `@${payload.username} connected to BotFlow.`
          : "Instagram connected to BotFlow.",
        variant: "success",
      });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    [queryClient],
  );

  useEffect(() => {
    const allowedOrigins = new Set([
      window.location.origin,
      "https://api.botflow.ink",
      "https://www.botflow.ink",
      "https://botflow.ink",
    ]);

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.has(event.origin)) return;
      if (event.data?.type !== "botflow:instagram-connected") return;
      handleConnected(event.data);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleConnected]);

  const startConnect = useCallback(() => {
    setBanner(null);
    setConnecting(true);

    try {
      openInstagramOAuthPopup();
    } catch (error) {
      setConnecting(false);
      setBanner({
        message: error instanceof Error ? error.message : "Could not start Instagram connect.",
        variant: "error",
      });
    }
  }, []);

  const channel = channelQuery.data;
  const loading = channelQuery.isLoading;

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center rounded-3xl border border-border/50 bg-card/40">
        <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
      </div>
    );
  }

  if (!channel) {
    return (
      <section className="space-y-4">
        {banner ? (
          <AppBanner message={banner.message} variant={banner.variant} onDismiss={() => setBanner(null)} />
        ) : null}

        <div className="rounded-3xl border border-border/50 bg-gradient-to-br from-pink-500/10 via-card/80 to-purple-500/10 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-lg">
            <Instagram className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-semibold tracking-tight">Connect Instagram</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Link your Instagram account to BotFlow. You stay in BotFlow — we only open a quick login popup.
          </p>
          <Button
            onClick={() => void startConnect()}
            disabled={connecting}
            className="mt-6 h-11 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 font-semibold text-white hover:opacity-90"
          >
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Instagram className="h-4 w-4" />}
            Connect Instagram
          </Button>
        </div>
      </section>
    );
  }

  const avatar = channel.avatarUrl ?? channel.profilePictureUrl;

  return (
    <section className="space-y-4">
      {banner ? (
        <AppBanner message={banner.message} variant={banner.variant} onDismiss={() => setBanner(null)} />
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 rounded-3xl border border-border/50 bg-card/80 p-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          {avatar ? (
            <img
              src={avatar}
              alt={channel.username}
              className="h-16 w-16 rounded-full border-2 border-pink-500/30 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-lg font-bold text-white">
              IG
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-pink-400">Connected</p>
            <h3 className="text-xl font-semibold tracking-tight">@{channel.username}</h3>
            <p className="text-sm text-muted-foreground">Managed in BotFlow</p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
          className="rounded-xl"
        >
          {disconnectMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unplug className="h-4 w-4" />
          )}
          Disconnect
        </Button>
      </motion.div>
    </section>
  );
}
