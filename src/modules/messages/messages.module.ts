import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { WhatsAppCloudApiService } from './whatsapp-cloud-api.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService, WhatsAppCloudApiService],
  exports: [MessagesService],
})
export class MessagesModule {}
