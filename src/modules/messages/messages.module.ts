import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { WhatsAppCloudApiService } from './whatsapp-cloud-api.service';

@Module({
  imports: [ChannelsModule],
  controllers: [MessagesController],
  providers: [MessagesService, WhatsAppCloudApiService],
  exports: [MessagesService],
})
export class MessagesModule {}
