import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { MetaService } from './meta.service';

@ApiTags('meta')
@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get('connect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  connect(@CurrentUser() user: JwtPayload) {
    return this.metaService.getEmbeddedSignupConfig(user.sub, user.organizationId);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
  ) {
    if (error || errorDescription) {
      throw new BadRequestException(
        errorDescription ?? error ?? 'Meta OAuth was denied',
      );
    }

    return this.metaService.handleCallback(code, state);
  }
}
