import { ApiProperty } from '@nestjs/swagger';
import { WhatsAppSessionStatus } from '@prisma/client';

export class WhatsAppSessionQrResponseDto {
  @ApiProperty({
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    description: 'QR code image as a base64 data URI for scanning in WhatsApp',
  })
  base64!: string;

  @ApiProperty({
    enum: WhatsAppSessionStatus,
    example: WhatsAppSessionStatus.CONNECTING,
  })
  status!: WhatsAppSessionStatus;

  @ApiProperty({
    example: 60,
    description: 'Seconds until the QR code expires and must be refreshed',
  })
  expiresIn!: number;
}
