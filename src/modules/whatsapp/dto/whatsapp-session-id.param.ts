import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class WhatsAppSessionIdParam {
  @ApiProperty({ format: 'uuid', description: 'WhatsApp session ID' })
  @IsUUID('4')
  id!: string;
}
