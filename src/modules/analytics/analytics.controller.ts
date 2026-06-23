import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@Controller('api/analytics')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.service.getDashboard(user.organizationId!);
  }
}
