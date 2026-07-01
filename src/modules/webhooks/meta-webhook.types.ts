export interface MetaWebhookPayload {
  object?: string;
  entry?: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id?: string;
  changes?: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  field?: string;
  value?: MetaWebhookChangeValue;
}

export interface MetaWebhookChangeValue {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  contacts?: Array<{
    profile?: { name?: string };
    wa_id?: string;
  }>;
  messages?: MetaInboundMessage[];
  statuses?: unknown[];
  errors?: unknown[];
}

export interface MetaInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
}

export interface ParsedInboundWhatsAppMessage {
  phoneNumberId: string;
  customerPhone: string;
  customerName: string;
  messageId: string;
  messageText: string;
  timestamp: Date;
}

export interface N8nForwardPayload {
  workspaceId: string;
  conversationId: string;
  phoneNumberId: string;
  customerPhone: string;
  customerName: string;
  message: string;
  messageId: string;
  timestamp: string;
}
