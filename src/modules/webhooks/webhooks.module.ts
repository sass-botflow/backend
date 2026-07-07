import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { WhatsAppCloudApiService } from '../messages/whatsapp-cloud-api.service';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { N8nForwarderService } from './n8n-forwarder.service';
import { WhatsAppChannelWebhookController } from './whatsapp-channel-webhook.controller';

@Module({
  imports: [ChannelsModule],
  controllers: [MetaWebhookController, WhatsAppChannelWebhookController],
  providers: [MetaWebhookService, N8nForwarderService, WhatsAppCloudApiService],
})
export class WebhooksModule {}
