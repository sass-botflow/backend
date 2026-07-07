import { IsNotEmpty, IsString } from 'class-validator';

export class WhatsAppEmbeddedSignupCompleteDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;
}
