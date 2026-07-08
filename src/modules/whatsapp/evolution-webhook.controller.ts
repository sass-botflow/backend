import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { N8nForwarderService } from '../webhooks/n8n-forwarder.service';
import { EvolutionWebhookPayload } from './evolution-api.types';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class EvolutionWebhookController {
  private readonly logger = new Logger(EvolutionWebhookController.name);

  constructor(
    private readonly whatsapp: WhatsAppEvolutionService,
    private readonly n8n: N8nForwarderService,
    private readonly config: ConfigService,
  ) {}

  @Post('evolution')
  async handleEvolutionWebhook(@Body() payload: EvolutionWebhookPayload) {
    const event = this.normalizeEvent(payload.event);
    const instanceName = payload.instance ?? String(payload.data?.instance ?? '');

    this.logger.log('Evolution webhook received', {
      event,
      instanceName,
      payload: payload.data,
    });

    if (!instanceName) {
      this.logger.warn('Evolution webhook missing instance name', { payload });
      return { received: true };
    }

    switch (event) {
      case 'QRCODE_UPDATED':
        await this.whatsapp.handleQrUpdate(instanceName, payload.data ?? {});
        break;

      case 'CONNECTION_UPDATE':
        await this.whatsapp.handleConnectedUpdate(instanceName, payload.data ?? {});
        break;

      case 'MESSAGES_UPSERT':
      case 'MESSAGE_RECEIVED':
        await this.forwardInboundMessage(instanceName, payload);
        break;

      case 'MESSAGE_SENT':
      case 'SEND_MESSAGE':
        this.logger.log('Evolution outbound message event', { instanceName });
        break;

      default:
        this.logger.debug('Unhandled Evolution webhook event', { event, instanceName });
    }

    return { received: true };
  }

  private normalizeEvent(event?: string): string {
    return (event ?? '')
      .trim()
      .toUpperCase()
      .replace(/\./g, '_');
  }

  private async forwardInboundMessage(
    instanceName: string,
    payload: EvolutionWebhookPayload,
  ): Promise<void> {
    const session = await this.whatsapp.findSessionByInstanceName(instanceName);
    if (!session) {
      return;
    }

    const messages = Array.isArray(payload.data?.messages)
      ? payload.data.messages
      : payload.data
        ? [payload.data]
        : [];

    for (const raw of messages) {
      if (!raw || typeof raw !== 'object') {
        continue;
      }

      const message = raw as Record<string, unknown>;
      const key = message.key as Record<string, unknown> | undefined;
      const fromMe = Boolean(key?.fromMe);

      if (fromMe) {
        continue;
      }

      const remoteJid = String(key?.remoteJid ?? '');
      const text =
        (message.message as Record<string, unknown> | undefined)?.conversation ??
        (
          (message.message as Record<string, unknown> | undefined)
            ?.extendedTextMessage as Record<string, unknown> | undefined
        )?.text;

      if (!remoteJid || typeof text !== 'string') {
        continue;
      }

      const customerPhone = remoteJid.replace(/@.*/, '').replace(/\D/g, '');

      await this.n8n.forwardInboundMessage({
        workspaceId: session.userId,
        phoneNumberId: session.instanceName,
        displayPhoneNumber: session.phone ?? session.instanceName,
        customerPhone,
        customerName: customerPhone,
        messageId: String(key?.id ?? `evolution-${Date.now()}`),
        messageType: 'text',
        text,
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  }
}
