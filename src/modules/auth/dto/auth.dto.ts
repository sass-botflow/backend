import { IsEmail, IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/;

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(USERNAME_RE, {
    message: 'Username must be 3-32 characters (letters, numbers, underscore).',
  })
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  organizationName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(USERNAME_RE)
  username!: string;

  @IsString()
  password!: string;
}
