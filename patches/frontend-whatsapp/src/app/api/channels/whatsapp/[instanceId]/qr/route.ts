import { NextResponse } from "next/server";
import { BackendAuthError } from "@/lib/backend/errors";
import { evolutionGetQr } from "@/lib/whatsapp/evolution-bff-service";
import { proxyBackendJsonWithEvolutionFallback } from "@/lib/whatsapp/whatsapp-bff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ instanceId: string }> },
) {
  const { instanceId } = await context.params;

  try {
    return await proxyBackendJsonWithEvolutionFallback(
      `/api/channels/whatsapp/${encodeURIComponent(instanceId)}/qr`,
      undefined,
      () => evolutionGetQr(instanceId),
    );
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "Could not load WhatsApp QR code.";

    return NextResponse.json({ error: message, message }, { status: 502 });
  }
}
