import { Logger } from '@nestjs/common';
import {
  MetaWebhookPayload,
  ParsedInboundWhatsAppMessage,
} from './meta-webhook.types';

export class MetaWebhookParser {
  private static readonly logger = new Logger(MetaWebhookParser.name);

  static parseInboundMessages(payload: unknown): ParsedInboundWhatsAppMessage[] {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const body = payload as MetaWebhookPayload;

    if (body.object !== 'whatsapp_business_account') {
      MetaWebhookParser.logger.debug(`Ignoring unsupported webhook object: ${body.object}`);
      return [];
    }

    const results: ParsedInboundWhatsAppMessage[] = [];

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') {
          MetaWebhookParser.logger.debug(`Ignoring unsupported webhook field: ${change.field}`);
          continue;
        }

        const value = change.value;
        if (!value || value.messaging_product !== 'whatsapp') {
          continue;
        }

        const phoneNumberId = value.metadata?.phone_number_id;
        if (!phoneNumberId) {
          MetaWebhookParser.logger.warn('Webhook message missing phone_number_id');
          continue;
        }

        const contactNameByWaId = new Map<string, string>();
        for (const contact of value.contacts ?? []) {
          if (contact.wa_id) {
            contactNameByWaId.set(contact.wa_id, contact.profile?.name ?? '');
          }
        }

        for (const message of value.messages ?? []) {
          if (message.type !== 'text' || !message.text?.body) {
            MetaWebhookParser.logger.debug(`Ignoring unsupported message type: ${message.type}`);
            continue;
          }

          if (!message.id || !message.from || !message.timestamp) {
            MetaWebhookParser.logger.warn('Skipping malformed inbound WhatsApp message');
            continue;
          }

          const timestampSeconds = Number(message.timestamp);
          const timestamp = Number.isFinite(timestampSeconds)
            ? new Date(timestampSeconds * 1000)
            : new Date();

          results.push({
            phoneNumberId,
            customerPhone: message.from,
            customerName: contactNameByWaId.get(message.from) ?? message.from,
            messageId: message.id,
            messageText: message.text.body,
            timestamp,
          });
        }
      }
    }

    return results;
  }
}
