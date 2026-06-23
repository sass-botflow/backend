import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('settings')
@Controller('api/settings')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('branding')
  branding(@CurrentUser() user: JwtPayload) {
    return this.service.getBranding(user.organizationId!);
  }

  @Patch('branding')
  updateBranding(
    @CurrentUser() user: JwtPayload,
    @Body() body: { primaryColor?: string; accentColor?: string; customDomain?: string; whiteLabel?: boolean },
  ) {
    return this.service.updateBranding(user.organizationId!, body);
  }

  @Get('api-keys')
  apiKeys(@CurrentUser() user: JwtPayload) {
    return this.service.listApiKeys(user.organizationId!);
  }
}
