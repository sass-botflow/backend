import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WhatsAppEmbeddedSignupCompleteDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsOptional()
  business_id?: string;

  @IsString()
  @IsOptional()
  waba_id?: string;

  @IsString()
  @IsOptional()
  phone_number_id?: string;
}
