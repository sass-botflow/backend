import { WhatsappSession, WhatsappSessionStatus } from '@prisma/client';

export function mapSessionStatus(
  status: WhatsappSessionStatus,
): 'CONNECTED' | 'DISCONNECTED' | 'WAITING_QR' | 'CONNECTING' {
  return status;
}

export function extractQrBase64(payload: {
  base64?: string;
  code?: string;
}): string | null {
  if (payload.base64?.trim()) {
    return payload.base64.trim();
  }
  if (payload.code?.trim()) {
    return payload.code.trim();
  }
  return null;
}

export function normalizeEvolutionConnectionState(
  state?: string,
): WhatsappSessionStatus {
  const normalized = state?.toLowerCase() ?? '';

  if (normalized === 'open') {
    return WhatsappSessionStatus.CONNECTED;
  }

  if (normalized === 'connecting') {
    return WhatsappSessionStatus.CONNECTING;
  }

  if (normalized === 'close' || normalized === 'closed' || normalized === 'refused') {
    return WhatsappSessionStatus.DISCONNECTED;
  }

  return WhatsappSessionStatus.WAITING_QR;
}

export function toPublicSession(session: WhatsappSession) {
  return {
    instanceId: session.id,
    instanceName: session.instanceName,
    phone: session.phone,
    profileName: session.profileName,
    status: mapSessionStatus(session.status),
    connectedAt: session.connectedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
