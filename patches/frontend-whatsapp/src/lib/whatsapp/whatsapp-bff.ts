import { NextResponse } from "next/server";
import { BackendAuthError } from "@/lib/backend/errors";
import { proxyBackendRequest } from "@/lib/backend/proxy";
import { isEvolutionConfigured } from "@/lib/whatsapp/evolution-server";

function isBackendFailure(response: Response): boolean {
  if (response.status === 404 || response.status === 502 || response.status === 503) {
    return true;
  }

  if (response.status >= 500) {
    return true;
  }

  const contentType = response.headers.get("content-type") ?? "";
  return contentType.toLowerCase().includes("text/html");
}

export function shouldUseEvolutionFallback(response: Response): boolean {
  return isEvolutionConfigured() && isBackendFailure(response);
}

/** Backend API first (persistent sessions), Evolution BFF as fallback — Qunvert-style QR flow */
export async function proxyBackendJsonWithEvolutionFallback<T>(
  backendPath: string,
  init: RequestInit | undefined,
  fallback: () => Promise<T>,
): Promise<NextResponse> {
  try {
    const response = await proxyBackendRequest(backendPath, {
      ...init,
      redirect: "manual",
    });

    if (!shouldUseEvolutionFallback(response)) {
      const body = await response.text();
      return new NextResponse(body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "application/json",
        },
      });
    }
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!isEvolutionConfigured()) {
      return NextResponse.json(
        {
          error:
            "WhatsApp backend is unavailable. Deploy backend from main and set EVOLUTION_API_URL.",
        },
        { status: 503 },
      );
    }
  }

  try {
    const result = await fallback();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    const message =
      error instanceof Error ? error.message : "WhatsApp request failed.";
    return NextResponse.json({ error: message, message }, { status: 502 });
  }
}

export async function proxyBackendChannelsWithEvolutionFallback(): Promise<NextResponse> {
  try {
    const response = await proxyBackendRequest("/api/channels");

    if (!shouldUseEvolutionFallback(response)) {
      const body = await response.text();
      return new NextResponse(body, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("content-type") ?? "application/json",
        },
      });
    }
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!isEvolutionConfigured()) {
      return NextResponse.json({ channels: [] });
    }
  }

  const { evolutionListChannels } = await import(
    "@/lib/whatsapp/evolution-bff-service"
  );

  try {
    const result = await evolutionListChannels();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BackendAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ channels: [] });
  }
}
