import { auth } from "@clerk/nextjs/server";
import { BackendAuthError } from "@/lib/backend/errors";
import {
  clearCachedQr,
  getCachedQr,
  setCachedQr,
} from "@/lib/whatsapp/evolution-qr-cache";
import {
  connectEvolutionInstance,
  createEvolutionInstance,
  deleteEvolutionInstance,
  deriveInstanceName,
  extractPhone,
  extractProfilePictureUrl,
  extractQrImageData,
  fetchEvolutionInstance,
  getEvolutionConnectionState,
  getEvolutionInstanceState,
  isEvolutionConfigured,
  mapConnectionState,
} from "@/lib/whatsapp/evolution-server";

const QR_EXPIRES_IN_SECONDS = 60;
const QR_CONNECT_TIMEOUT_MS = 20_000;

function isTransientEvolutionError(message: string): boolean {
  return /fetch failed|econnrefused|enotfound|timeout|abort|cloudflare|bad gateway|gateway|could not reach|offline|unreachable|starting|not ready|returned html|<!doctype/i.test(
    message,
  );
}

function qrReadyResponse(instanceId: string, qrCode: string) {
  setCachedQr(instanceId, qrCode);

  return {
    instanceId,
    qrCode,
    base64: qrCode,
    expiresIn: QR_EXPIRES_IN_SECONDS,
    status: "WAITING_QR" as const,
  };
}

async function requireUserId(): Promise<string> {
  const authState = await auth({ treatPendingAsSignedOut: false });
  if (!authState.userId) {
    throw new BackendAuthError();
  }
  return authState.userId;
}

function assertOwnedInstance(userId: string, instanceId: string): string {
  const instanceName = deriveInstanceName(userId);
  if (instanceId !== instanceName) {
    throw new Error("You do not have access to this WhatsApp session.");
  }
  return instanceName;
}

async function extractQrFromPayload(payload: unknown): Promise<string | null> {
  if (!payload) return null;
  return extractQrImageData(payload);
}

async function ensureEvolutionInstance(instanceName: string): Promise<string | null> {
  let existing = (await fetchEvolutionInstance(instanceName)) as Record<
    string,
    unknown
  > | null;

  if (existing) {
    const state = getEvolutionInstanceState(existing);
    const normalized = (state ?? "").toLowerCase();

    if (
      normalized === "close" ||
      normalized === "closed" ||
      normalized === "connecting"
    ) {
      clearCachedQr(instanceName);
      try {
        await deleteEvolutionInstance(instanceName);
        existing = null;
      } catch {
        // Continue with reconnect attempt.
      }
    } else if (normalized === "open") {
      // Already connected — no QR needed (status poll will pick this up).
      return null;
    } else {
      const cachedQr = await extractQrFromPayload(existing.qrcode ?? existing);
      if (cachedQr) {
        setCachedQr(instanceName, cachedQr);
        return cachedQr;
      }
    }
  }

  if (!existing) {
    const created = await createEvolutionInstance(instanceName);
    const createdQr = await extractQrFromPayload(created);
    if (createdQr) {
      setCachedQr(instanceName, createdQr);
      return createdQr;
    }
  }

  return null;
}

async function prepareWhatsAppSession(instanceName: string): Promise<string | null> {
  const cached = getCachedQr(instanceName);
  if (cached) return cached;

  const existingQr = await ensureEvolutionInstance(instanceName);
  if (existingQr) return existingQr;

  const connectPayload = await connectEvolutionInstance(
    instanceName,
    QR_CONNECT_TIMEOUT_MS,
  );
  const connectQr = await extractQrFromPayload(connectPayload);
  if (connectQr) {
    setCachedQr(instanceName, connectQr);
    return connectQr;
  }

  const refreshed = await fetchEvolutionInstance(instanceName);
  const refreshedQr = await extractQrFromPayload(refreshed?.qrcode ?? refreshed);
  if (refreshedQr) {
    setCachedQr(instanceName, refreshedQr);
    return refreshedQr;
  }

  return null;
}

export async function evolutionConnectInstanceId() {
  if (!isEvolutionConfigured()) {
    throw new Error("Evolution API is not configured on the frontend server.");
  }

  const userId = await requireUserId();

  return {
    instanceId: deriveInstanceName(userId),
  };
}

export async function evolutionConnect() {
  if (!isEvolutionConfigured()) {
    throw new Error("Evolution API is not configured on the frontend server.");
  }

  const userId = await requireUserId();
  const instanceName = deriveInstanceName(userId);

  const existing = (await fetchEvolutionInstance(instanceName)) as Record<
    string,
    unknown
  > | null;
  if (existing) {
    const state = getEvolutionInstanceState(existing)?.toLowerCase();
    if (state === "open") {
      return {
        instanceId: instanceName,
        status: "connected" as const,
        qrCode: null,
      };
    }
  }

  let qrCode: string | null = null;
  try {
    qrCode = await prepareWhatsAppSession(instanceName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isTransientEvolutionError(message)) {
      throw error;
    }
  }

  return {
    instanceId: instanceName,
    status: "waiting_qr" as const,
    qrCode,
  };
}

export async function evolutionGetQr(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

  const cached = getCachedQr(instanceName);
  if (cached) {
    return qrReadyResponse(instanceId, cached);
  }

  try {
    const qrCode = await prepareWhatsAppSession(instanceName);

    if (!qrCode) {
      throw new Error(
        "QR code is still generating. Evolution API is preparing your session.",
      );
    }

    return qrReadyResponse(instanceId, qrCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isTransientEvolutionError(message)) {
      throw new Error(
        "Could not reach Evolution API. Check botflow-evolution is running.",
      );
    }

    throw error;
  }
}

export async function evolutionGetStatus(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

  const details = await fetchEvolutionInstance(instanceName);
  if (!details) {
    return {
      instanceId,
      status: "WAITING_QR" as const,
      phone: null,
      phoneNumber: null,
      profileName: null,
      profilePictureUrl: null,
      connectedAt: null,
    };
  }

  let mapped: ReturnType<typeof mapConnectionState> = "WAITING_QR";

  try {
    const state = await getEvolutionConnectionState(instanceName);
    mapped = mapConnectionState(
      state.instance?.state ??
        state.state ??
        getEvolutionInstanceState(details as Record<string, unknown>),
    );
  } catch {
    mapped = mapConnectionState(getEvolutionInstanceState(details as Record<string, unknown>));
  }

  if (mapped === "CONNECTED") {
    clearCachedQr(instanceName);
  }

  const phone =
    extractPhone(typeof details.owner === "string" ? details.owner : null) ?? null;
  const profileName =
    typeof details.profileName === "string" ? details.profileName : null;
  const profilePictureUrl = extractProfilePictureUrl(details as Record<string, unknown>);

  return {
    instanceId,
    status: mapped,
    phone,
    phoneNumber: phone,
    profileName,
    profilePictureUrl,
    connectedAt: mapped === "CONNECTED" ? new Date().toISOString() : null,
  };
}

export async function evolutionDelete(instanceId: string) {
  const userId = await requireUserId();
  const instanceName = assertOwnedInstance(userId, instanceId);

  clearCachedQr(instanceName);

  try {
    await deleteEvolutionInstance(instanceName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/not found|404/i.test(message)) {
      throw error;
    }
  }

  return {
    deleted: true,
    instanceId,
    success: true,
  };
}

export async function evolutionListChannels() {
  if (!isEvolutionConfigured()) {
    return { channels: [] as Array<Record<string, unknown>> };
  }

  const userId = await requireUserId();
  const instanceName = deriveInstanceName(userId);
  const details = await fetchEvolutionInstance(instanceName);

  if (!details) {
    return { channels: [] as Array<Record<string, unknown>> };
  }

  let mapped: ReturnType<typeof mapConnectionState> = "WAITING_QR";

  try {
    const state = await getEvolutionConnectionState(instanceName);
    mapped = mapConnectionState(
      state.instance?.state ??
        state.state ??
        getEvolutionInstanceState(details as Record<string, unknown>),
    );
  } catch {
    mapped = mapConnectionState(getEvolutionInstanceState(details as Record<string, unknown>));
  }

  const phone = extractPhone(typeof details.owner === "string" ? details.owner : null);
  const profilePictureUrl = extractProfilePictureUrl(details as Record<string, unknown>);

  return {
    channels: [
      {
        id: instanceName,
        provider: "whatsapp",
        status: mapped,
        displayPhoneNumber: phone,
        businessName:
          typeof details.profileName === "string" ? details.profileName : null,
        profilePictureUrl,
        avatarUrl: profilePictureUrl,
        connectedAt: mapped === "CONNECTED" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
        phoneNumberId: instanceName,
      },
    ],
  };
}
