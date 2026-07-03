import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { N8nForwarderService } from './n8n-forwarder.service';

@Module({
  imports: [ChannelsModule],
  controllers: [MetaWebhookController],
  providers: [MetaWebhookService, N8nForwarderService],
})
export class WebhooksModule {}
