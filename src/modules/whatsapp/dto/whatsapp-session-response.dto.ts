import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WhatsAppSessionStatus } from '@prisma/client';

export class WhatsAppSessionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ example: 'botflow-a1b2c3d4-e5f6a7b8' })
  instanceName!: string;

  @ApiProperty({ example: 'Support WhatsApp' })
  displayName!: string;

  @ApiPropertyOptional({ example: '+212612345678', nullable: true })
  phoneNumber!: string | null;

  @ApiProperty({ enum: WhatsAppSessionStatus })
  status!: WhatsAppSessionStatus;

  @ApiProperty({ example: 'evolution' })
  engine!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class WhatsAppSessionItemResponseDto {
  @ApiProperty({ type: WhatsAppSessionResponseDto })
  session!: WhatsAppSessionResponseDto;
}

export class WhatsAppSessionsListResponseDto {
  @ApiProperty({ type: [WhatsAppSessionResponseDto] })
  sessions!: WhatsAppSessionResponseDto[];
}
