import { Module } from '@nestjs/common';
import { N8nForwarderService } from './n8n-forwarder.service';

@Module({
  providers: [N8nForwarderService],
  exports: [N8nForwarderService],
})
export class WebhooksModule {}
