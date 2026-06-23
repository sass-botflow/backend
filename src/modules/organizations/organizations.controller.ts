import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('organizations')
@Controller('api/organizations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get('current')
  getCurrent(@CurrentUser() user: JwtPayload) {
    return this.service.getCurrent(user.organizationId!);
  }

  @Get('members')
  getMembers(@CurrentUser() user: JwtPayload) {
    return this.service.getMembers(user.organizationId!);
  }
}
