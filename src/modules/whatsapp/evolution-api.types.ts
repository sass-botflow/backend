export const EVOLUTION_INTEGRATION = 'WHATSAPP-BAILEYS';

export const EVOLUTION_WEBHOOK_EVENTS = [
  'QRCODE_UPDATED',
  'CONNECTION_UPDATE',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'SEND_MESSAGE',
] as const;

export type EvolutionWebhookEvent = (typeof EVOLUTION_WEBHOOK_EVENTS)[number];

export type EvolutionConnectionState = 'open' | 'close' | 'connecting' | 'refused';

export interface EvolutionProviderConfig {
  baseUrl: string;
  apiKey: string;
  webhookUrl: string;
}

export interface EvolutionCreateInstancePayload {
  instanceName: string;
  integration: string;
  qrcode: boolean;
  webhook?: {
    url: string;
    byEvents: boolean;
    base64: boolean;
    events: string[];
  };
}

export interface EvolutionQrResponse {
  base64?: string;
  code?: string;
  pairingCode?: string;
  count?: number;
}

export interface EvolutionConnectionStateResponse {
  instance?: { instanceName?: string; state?: string };
  state?: string;
}

export interface EvolutionSendTextPayload {
  number: string;
  text: string;
}

export interface EvolutionSendTextResponse {
  key?: { id?: string };
  message?: { conversation?: string };
}

export interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
  data?: Record<string, unknown>;
}
