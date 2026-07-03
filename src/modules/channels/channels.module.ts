import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChannelResolverService } from './channel-resolver.service';
import { ChannelsController, WhatsAppOAuthController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { WhatsAppGraphApiService } from './whatsapp-graph-api.service';
import { WhatsAppOAuthStateService } from './whatsapp-oauth-state.service';

@Module({
  imports: [AuthModule],
  controllers: [ChannelsController, WhatsAppOAuthController],
  providers: [
    ChannelsService,
    WhatsAppGraphApiService,
    WhatsAppOAuthStateService,
    ChannelResolverService,
  ],
  exports: [ChannelsService, ChannelResolverService, WhatsAppGraphApiService],
})
export class ChannelsModule {}
