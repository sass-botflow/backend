import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';

export interface ConnectWhatsAppResult {
  instanceId: string;
  status: 'waiting_qr';
}

export interface QrCodeResult {
  instanceId: string;
  qrCode: string;
  status: string;
}

export interface SessionStatusResult {
  instanceId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'WAITING_QR' | 'CONNECTING';
  phone?: string | null;
  profileName?: string | null;
  connectedAt?: string | null;
}

export interface ConnectedSessionResult {
  connected: true;
  phone: string | null;
  profileName: string | null;
  status: 'CONNECTED';
  instanceId: string;
}

export interface SendMessageResult {
  success: true;
  messageId: string;
  instanceId: string;
  to: string;
}

export interface DeleteSessionResult {
  deleted: true;
  instanceId: string;
}

export { SendWhatsAppMessageDto };
