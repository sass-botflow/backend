import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SendMessageDto } from './dto/send-message.dto';
import { MessagesService } from './messages.service';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('send')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send an outbound WhatsApp text message',
    description:
      'Validates the workspace, resolves the connected WhatsApp account, sends via the WhatsApp Cloud API, and persists the outbound message.',
  })
  @ApiResponse({ status: 200, description: 'Message sent and saved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request or disconnected account' })
  @ApiResponse({ status: 404, description: 'Workspace, conversation, or account not found' })
  @ApiResponse({ status: 502, description: 'WhatsApp Cloud API failure' })
  send(@Body() dto: SendMessageDto) {
    return this.messagesService.sendOutboundMessage(dto);
  }
}
