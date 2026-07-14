const QR_CACHE_TTL_MS = 50_000;

interface QrCacheEntry {
  qrCode: string;
  expiresAt: number;
}

const qrCache = new Map<string, QrCacheEntry>();

export function getCachedQr(instanceName: string): string | null {
  const entry = qrCache.get(instanceName);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    qrCache.delete(instanceName);
    return null;
  }

  return entry.qrCode;
}

export function setCachedQr(instanceName: string, qrCode: string): void {
  if (!qrCode) return;

  qrCache.set(instanceName, {
    qrCode,
    expiresAt: Date.now() + QR_CACHE_TTL_MS,
  });
}

export function clearCachedQr(instanceName: string): void {
  qrCache.delete(instanceName);
}
