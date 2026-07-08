import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class SendWhatsAppMessageDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{8,15}$/)
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text!: string;
}
