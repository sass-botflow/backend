import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { MetaGraphService } from './meta-graph.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppOAuthStateService } from './whatsapp-oauth-state.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [AuthModule],
  controllers: [IntegrationsController, WhatsAppController],
  providers: [
    IntegrationsService,
    WhatsAppService,
    WhatsAppOAuthStateService,
    MetaGraphService,
  ],
  exports: [WhatsAppService],
})
export class IntegrationsModule {}
