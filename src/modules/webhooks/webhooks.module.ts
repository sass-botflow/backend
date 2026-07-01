import { Module } from '@nestjs/common';
import { MetaWebhookController } from './meta-webhook.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { N8nForwarderService } from './n8n-forwarder.service';

@Module({
  controllers: [MetaWebhookController],
  providers: [MetaWebhookService, N8nForwarderService],
})
export class WebhooksModule {}
