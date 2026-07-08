import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { ChannelsController } from './channels.controller';
import { EvolutionWebhookController } from './evolution-webhook.controller';
import { EvolutionApiService } from './evolution-api.service';
import { WhatsAppEvolutionController } from './whatsapp-evolution.controller';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';

@Module({
  imports: [AuthModule, WebhooksModule],
  controllers: [ChannelsController, WhatsAppEvolutionController, EvolutionWebhookController],
  providers: [EvolutionApiService, WhatsAppEvolutionService],
  exports: [EvolutionApiService, WhatsAppEvolutionService],
})
export class WhatsAppModule {}
