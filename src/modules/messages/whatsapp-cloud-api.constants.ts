export const WHATSAPP_CLOUD_API_VERSION = 'v22.0';

/** Graph API error codes that indicate a transient failure worth retrying. */
export const RETRYABLE_GRAPH_ERROR_CODES = new Set([
  1, // API Unknown
  2, // API Service temporarily unavailable
  4, // API Too many calls
  17, // User request limit reached
  341, // Application limit reached
  80007, // Rate limit issues
]);

export const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface WhatsAppSendMessageResult {
  whatsappMessageId: string;
  recipientWaId: string;
}

export interface MetaGraphApiErrorBody {
  error?: {
    message: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface WhatsAppSendMessageResponse extends MetaGraphApiErrorBody {
  messaging_product?: string;
  contacts?: Array<{ input: string; wa_id: string }>;
  messages?: Array<{ id: string }>;
}
