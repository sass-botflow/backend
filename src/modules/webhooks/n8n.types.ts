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

export interface N8nReplyPayload {
  reply?: string;
  message?: string;
  text?: string;
  messages?: Array<{ text?: string; message?: string; reply?: string }>;
}

export interface EvolutionN8nInboundPayload {
  workspaceId: string;
  phoneNumberId: string;
  displayPhoneNumber: string;
  customerPhone: string;
  customerName: string;
  messageId: string;
  messageType: string;
  text: string;
  timestamp: number;
}
