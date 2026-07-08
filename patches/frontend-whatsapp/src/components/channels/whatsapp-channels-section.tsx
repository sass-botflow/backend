"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Plus } from "lucide-react";
import { AppBanner } from "@/components/ui/app-banner";
import { DisconnectWhatsAppDialog } from "@/components/channels/disconnect-whatsapp-dialog";
import { WhatsAppChannelDashboardCard } from "@/components/channels/whatsapp-channel-dashboard-card";
import { WhatsAppConnectCard } from "@/components/channels/whatsapp-connect-card";
import { WhatsAppQrModal } from "@/components/channels/whatsapp-qr-modal";
import { ChannelsHeroSkeleton } from "@/components/channels/channels-skeleton";
import {
  useWhatsAppChannels,
  useWhatsAppConnect,
  useWhatsAppDisconnect,
} from "@/hooks/use-whatsapp-evolution";
import { Button } from "@/components/ui/button";
import type { WhatsAppChannel } from "@/lib/whatsapp/evolution-types";
import { whatsappQueryKeys } from "@/lib/whatsapp/evolution-query-keys";

export function WhatsAppChannelsSection() {
  const queryClient = useQueryClient();
  const channelsQuery = useWhatsAppChannels();
  const connectMutation = useWhatsAppConnect();
  const disconnectMutation = useWhatsAppDisconnect();

  const [qrOpen, setQrOpen] = useState(false);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<WhatsAppChannel | null>(
    null,
  );
  const [banner, setBanner] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const channels = channelsQuery.data ?? [];
  const loading = channelsQuery.isLoading;
  const hasChannels = channels.length > 0;

  const [initialQrCode, setInitialQrCode] = useState<string | null>(null);

  const startConnect = useCallback(async () => {
    setBanner(null);

    try {
      const result = await connectMutation.mutateAsync();
      setActiveInstanceId(result.instanceId);
      setInitialQrCode(result.qrCode ?? null);
      setQrOpen(true);
    } catch (error) {
      setBanner({
        message:
          error instanceof Error
            ? error.message
            : "Could not start WhatsApp connection.",
        variant: "error",
      });
    }
  }, [connectMutation]);

  const handleConnected = useCallback(async (_channel: WhatsAppChannel) => {
    setBanner({
      message: "WhatsApp connected successfully.",
      variant: "success",
    });
    setInitialQrCode(null);
    await queryClient.invalidateQueries({ queryKey: whatsappQueryKeys.channels() });
  }, [queryClient]);

  const handleDisconnect = useCallback(
    async (instanceId: string) => {
      try {
        await disconnectMutation.mutateAsync(instanceId);
        setDisconnectTarget(null);
        setBanner({
          message: "WhatsApp disconnected.",
          variant: "success",
        });
      } catch (error) {
        setBanner({
          message:
            error instanceof Error
              ? error.message
              : "Could not disconnect WhatsApp.",
          variant: "error",
        });
      }
    },
    [disconnectMutation],
  );

  const handleReconnect = useCallback((channel: WhatsAppChannel) => {
    setActiveInstanceId(channel.instanceId);
    setQrOpen(true);
  }, []);

  return (
    <section className="space-y-6">
      <DisconnectWhatsAppDialog
        channel={disconnectTarget}
        open={disconnectTarget !== null}
        loading={disconnectMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
        onConfirm={handleDisconnect}
      />

      <WhatsAppQrModal
        open={qrOpen}
        instanceId={activeInstanceId}
        initialQrCode={initialQrCode}
        onOpenChange={(open) => {
          setQrOpen(open);
          if (!open) {
            setActiveInstanceId(null);
            setInitialQrCode(null);
          }
        }}
        onConnected={handleConnected}
      />

      {banner ? (
        <AppBanner
          message={banner.message}
          variant={banner.variant}
          onDismiss={() => setBanner(null)}
        />
      ) : null}

      {channelsQuery.error ? (
        <AppBanner
          message={
            channelsQuery.error instanceof Error
              ? channelsQuery.error.message
              : "Could not load WhatsApp channels."
          }
          variant="error"
          onDismiss={() => void channelsQuery.refetch()}
        />
      ) : null}

      {loading ? (
        <ChannelsHeroSkeleton />
      ) : !hasChannels ? (
        <WhatsAppConnectCard
          onConnect={() => void startConnect()}
          loading={connectMutation.isPending}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold tracking-tight">
                Connected numbers
              </h3>
              <p className="text-sm text-muted-foreground">
                Manage WhatsApp sessions linked through Evolution API.
              </p>
            </div>
            <Button
              onClick={() => void startConnect()}
              disabled={connectMutation.isPending}
              className="h-11 rounded-xl bg-[#25D366] font-semibold text-white hover:bg-[#1fb855]"
            >
              {connectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add another number
            </Button>
          </div>

          <div className="space-y-4">
            {channels.map((channel, index) => (
              <WhatsAppChannelDashboardCard
                key={channel.instanceId}
                channel={channel}
                index={index}
                loading={
                  disconnectMutation.isPending &&
                  disconnectTarget?.instanceId === channel.instanceId
                }
                onDisconnect={setDisconnectTarget}
                onReconnect={handleReconnect}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <SummaryTile label="Connected lines" value={String(channels.length)} />
            <SummaryTile label="Routing" value="Active" />
          </motion.div>
        </div>
      )}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl border border-border/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-400">
        {value}
      </p>
    </div>
  );
}
