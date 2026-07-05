import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WhatsAppSessionStatus } from '@prisma/client';

export class WhatsAppSessionStatusResponseDto {
  @ApiProperty({ enum: WhatsAppSessionStatus })
  status!: WhatsAppSessionStatus;

  @ApiPropertyOptional({
    example: '+212612345678',
    nullable: true,
    description: 'Connected WhatsApp phone number when available',
  })
  phoneNumber!: string | null;

  @ApiProperty({
    example: 'Support',
    description: 'WhatsApp profile name when connected, otherwise the session label',
  })
  displayName!: string;
}
