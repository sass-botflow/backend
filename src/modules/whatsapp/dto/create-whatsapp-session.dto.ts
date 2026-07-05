import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWhatsAppSessionDto {
  @ApiPropertyOptional({ description: 'Human-readable label for this WhatsApp session' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
