import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('appointments')
@Controller('api/appointments')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.service.list(user.organizationId!);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; contactId: string; startsAt: string; endsAt: string; notes?: string },
  ) {
    return this.service.create(user.organizationId!, body);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: AppointmentStatus) {
    return this.service.updateStatus(id, status);
  }

  @Get('availability')
  availability(@CurrentUser() user: JwtPayload) {
    return this.service.getAvailability(user.organizationId!);
  }

  @Post('availability')
  setAvailability(
    @CurrentUser() user: JwtPayload,
    @Body() body: { dayOfWeek: number; startTime: string; endTime: string },
  ) {
    return this.service.setAvailability(user.organizationId!, body);
  }
}
