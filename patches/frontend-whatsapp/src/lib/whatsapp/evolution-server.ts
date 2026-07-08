const INTEGRATION = "WHATSAPP-BAILEYS";
const REQUEST_TIMEOUT_MS = 8_000;

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
}

function getEvolutionBaseUrlCandidates(): string[] {
  const candidates = [
    process.env.EVOLUTION_API_URL?.trim(),
    process.env.EVOLUTION_API_BASE_URL?.trim(),
    "http://sass-botflow_evolution-api:8080",
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates.map((value) => value.replace(/\/$/, "")))];
}

export function getEvolutionConfig(): EvolutionConfig | null {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrls = getEvolutionBaseUrlCandidates();

  if (!apiKey || baseUrls.length === 0) {
    return null;
  }

  return {
    baseUrl: baseUrls[0]!,
    apiKey,
  };
}

export function getEvolutionBaseUrls(): string[] {
  return getEvolutionBaseUrlCandidates();
}

export function isEvolutionConfigured(): boolean {
  return getEvolutionConfig() !== null;
}

export function deriveInstanceName(userId: string): string {
  const userShort = userId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `botflow-${userShort}`;
}

function normalizeQrString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image")) return trimmed;
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length > 100) {
    return `data:image/png;base64,${trimmed}`;
  }
  return trimmed;
}

export function extractQrBase64(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === "string" && payload.trim()) {
    return normalizeQrString(payload);
  }
  if (typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.base64,
    typeof record.qrcode === "object" && record.qrcode
      ? (record.qrcode as Record<string, unknown>).base64
      : record.qrcode,
    record.code,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return normalizeQrString(candidate);
    }
  }

  return null;
}

export function mapConnectionState(state?: string): "CONNECTED" | "DISCONNECTED" | "WAITING_QR" | "CONNECTING" {
  const normalized = (state ?? "").toLowerCase();

  if (normalized === "open") return "CONNECTED";
  if (normalized === "connecting") return "CONNECTING";
  if (normalized === "close" || normalized === "closed" || normalized === "refused") {
    return "DISCONNECTED";
  }

  return "WAITING_QR";
}

export function extractPhone(owner?: string | null): string | null {
  if (!owner?.trim()) return null;
  return owner.replace(/@.*/, "").replace(/\D/g, "") || null;
}

async function evolutionRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  const baseUrls = getEvolutionBaseUrlCandidates();

  if (!apiKey || baseUrls.length === 0) {
    throw new Error("Evolution API is not configured on the frontend server.");
  }

  let lastError: unknown;

  for (const baseUrl of baseUrls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      const text = await response.text();
      let data: unknown = null;

      if (text) {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = text;
        }
      }

      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "message" in data &&
          typeof (data as { message: unknown }).message === "string"
            ? (data as { message: string }).message
            : `Evolution API request failed (${response.status})`;
        throw new Error(message);
      }

      return data as T;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (/fetch failed|econnrefused|enotfound|timeout|abort/i.test(message)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? lastError.message
      : "Could not reach Evolution API. Set EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080",
  );
}

export async function createEvolutionInstance(instanceName: string): Promise<unknown> {
  const webhookUrl =
    process.env.EVOLUTION_WEBHOOK_URL?.trim() ||
    `${process.env.BACKEND_API_URL?.replace(/\/$/, "") || "https://api.botflow.ink"}/webhooks/evolution`;

  try {
    return await evolutionRequest("POST", "/instance/create", {
      instanceName,
      integration: INTEGRATION,
      qrcode: true,
      webhook: {
        url: webhookUrl,
        byEvents: true,
        base64: true,
        events: [
          "QRCODE_UPDATED",
          "CONNECTION_UPDATE",
          "MESSAGES_UPSERT",
          "SEND_MESSAGE",
        ],
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exist/i.test(message)) {
      throw error;
    }
    return null;
  }
}

export async function fetchEvolutionInstance(instanceName: string) {
  try {
    const data = await evolutionRequest<unknown>(
      "GET",
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    );

    const rows = Array.isArray(data) ? data : [data];

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const record = row as Record<string, unknown>;
      const instance = (record.instance ?? record) as Record<string, unknown>;
      if (instance.instanceName === instanceName) {
        return instance;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not found|404/i.test(message)) {
      throw error;
    }
  }

  return null;
}

export async function connectEvolutionInstance(instanceName: string) {
  return evolutionRequest<unknown>(
    "GET",
    `/instance/connect/${encodeURIComponent(instanceName)}`,
  );
}

export async function getEvolutionConnectionState(instanceName: string) {
  return evolutionRequest<{
    instance?: { state?: string };
    state?: string;
  }>("GET", `/instance/connectionState/${encodeURIComponent(instanceName)}`);
}

export async function deleteEvolutionInstance(instanceName: string): Promise<void> {
  await evolutionRequest(
    "DELETE",
    `/instance/delete/${encodeURIComponent(instanceName)}`,
  );
}
