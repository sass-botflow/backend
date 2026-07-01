import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Organization / workspace ID' })
  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @ApiProperty({ description: 'Conversation to send the message in' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ description: 'Meta WhatsApp phone number ID' })
  @IsString()
  @IsNotEmpty()
  phoneNumberId!: string;

  @ApiProperty({ description: 'Outbound text message body' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  message!: string;
}
