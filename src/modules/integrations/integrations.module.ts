import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  controllers: [IntegrationsController, WhatsAppController],
  providers: [IntegrationsService, WhatsAppService],
  exports: [WhatsAppService],
})
export class IntegrationsModule {}
