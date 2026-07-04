import { IsNotEmpty, IsString } from 'class-validator';

export class WhatsAppEmbeddedSignupCompleteDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  business_id!: string;

  @IsString()
  @IsNotEmpty()
  waba_id!: string;

  @IsString()
  @IsNotEmpty()
  phone_number_id!: string;
}
