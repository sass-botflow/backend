import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.appointment.findMany({
      where: { organizationId },
      include: { contact: true },
      orderBy: { startsAt: 'asc' },
    });
  }

  create(
    organizationId: string,
    data: { title: string; contactId: string; startsAt: string; endsAt: string; notes?: string },
  ) {
    return this.prisma.appointment.create({
      data: {
        title: data.title,
        contactId: data.contactId,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        notes: data.notes,
        organizationId,
      },
      include: { contact: true },
    });
  }

  updateStatus(id: string, status: AppointmentStatus) {
    return this.prisma.appointment.update({
      where: { id },
      data: { status },
      include: { contact: true },
    });
  }

  getAvailability(organizationId: string) {
    return this.prisma.availabilitySlot.findMany({
      where: { organizationId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  setAvailability(
    organizationId: string,
    data: { dayOfWeek: number; startTime: string; endTime: string },
  ) {
    return this.prisma.availabilitySlot.create({
      data: { ...data, organizationId },
    });
  }
}
