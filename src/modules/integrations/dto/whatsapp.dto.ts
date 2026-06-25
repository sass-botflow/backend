import { IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { WhatsAppAccountStatus } from '@prisma/client';

export class ConnectWhatsAppDto {
  @IsString()
  @IsNotEmpty()
  phoneNumberId!: string;

  @IsString()
  @IsNotEmpty()
  businessAccountId!: string;

  @IsString()
  @MinLength(10)
  accessToken!: string;
}

export class UpdateWhatsAppDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  accessToken?: string;

  @IsOptional()
  @IsEnum(WhatsAppAccountStatus)
  status?: WhatsAppAccountStatus;
}
