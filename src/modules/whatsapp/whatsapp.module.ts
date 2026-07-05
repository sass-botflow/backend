import { Module } from '@nestjs/common';
import { EvolutionProvider } from './providers/evolution.provider';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  controllers: [WhatsAppController],
  providers: [WhatsAppService, EvolutionProvider],
  exports: [WhatsAppService, EvolutionProvider],
})
export class WhatsAppModule {}
