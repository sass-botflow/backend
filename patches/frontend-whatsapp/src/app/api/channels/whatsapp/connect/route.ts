import { NextResponse } from "next/server";
import { BackendAuthError } from "@/lib/backend/errors";
import {
  evolutionConnect,
  evolutionConnectInstanceId,
} from "@/lib/whatsapp/evolution-bff-service";
import { isEvolutionConfigured } from "@/lib/whatsapp/evolution-server";
import { proxyBackendJsonWithEvolutionFallback } from "@/lib/whatsapp/whatsapp-bff";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    if (!isEvolutionConfigured()) {
      return NextResponse.json(
        {
          error:
            "Set EVOLUTION_API_URL and EVOLUTION_API_KEY on the frontend server.",
        },
        { status: 503 },
      );
    }

    const result = await evolutionConnectInstanceId();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "WhatsApp connect failed.";

    return NextResponse.json({ error: message, message }, { status: 502 });
  }
}

export async function POST() {
  try {
    return await proxyBackendJsonWithEvolutionFallback(
      "/api/channels/whatsapp/connect",
      { method: "POST" },
      evolutionConnect,
    );
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "WhatsApp connect failed.";

    return NextResponse.json(
      {
        error: isEvolutionConfigured()
          ? message
          : "Set EVOLUTION_API_URL and EVOLUTION_API_KEY on the frontend server.",
        message,
      },
      { status: 502 },
    );
  }
}
