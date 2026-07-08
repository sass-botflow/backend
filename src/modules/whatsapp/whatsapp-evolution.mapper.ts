import { WhatsappSession, WhatsappSessionStatus } from '@prisma/client';

export function mapSessionStatus(
  status: WhatsappSessionStatus,
): 'CONNECTED' | 'DISCONNECTED' | 'WAITING_QR' | 'CONNECTING' {
  return status;
}

function normalizeQrString(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('data:image')) {
    return trimmed;
  }

  // Raw base64 without data-uri prefix (Evolution sometimes returns this)
  if (/^[A-Za-z0-9+/]+=*$/.test(trimmed) && trimmed.length > 100) {
    return `data:image/png;base64,${trimmed}`;
  }

  return trimmed;
}

function readNestedQr(node: unknown): string | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const record = node as Record<string, unknown>;
  const candidates = [record.base64, record.code, record.qrcode];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeQrString(candidate);
    }
    if (candidate && typeof candidate === 'object') {
      const nested = readNestedQr(candidate);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export function extractQrBase64(payload: unknown): string | null {
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string' && payload.trim()) {
    return normalizeQrString(payload);
  }

  if (typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const fromRoot = readNestedQr(record);
  if (fromRoot) {
    return fromRoot;
  }

  if (record.data && typeof record.data === 'object') {
    return readNestedQr(record.data);
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

export function toPublicSession(session: WhatsappSession, qrCode?: string | null) {
  return {
    instanceId: session.id,
    instanceName: session.instanceName,
    phone: session.phone,
    profileName: session.profileName,
    status: mapSessionStatus(session.status),
    qrCode: qrCode ?? session.qrCode ?? null,
    connectedAt: session.connectedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
