import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // "CYC-YYMMDD-00001" — YYMMDD of the incident (or right now, if no incident date was
  // given/known) plus that day's sequence number. Computed by counting existing reports
  // whose number already starts with today's date prefix, not a separate counter table —
  // report volume is low enough that this is simple and correct without a race-prone
  // shared counter.
  private async generateReportNumber(incidentAt?: Date): Promise<string> {
    const date = incidentAt ?? new Date();
    const datePrefix = `CYC-${pad(date.getFullYear() % 100, 2)}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`;
    const countToday = await this.prisma.report.count({ where: { reportNumber: { startsWith: datePrefix } } });
    return `${datePrefix}-${pad(countToday + 1, 5)}`;
  }

  async create(reporterId: string, dto: CreateReportDto) {
    if (dto.reportedUserId === reporterId) {
      throw new BadRequestException('You cannot report yourself.');
    }

    const incidentAt = dto.incidentAt ? new Date(dto.incidentAt) : undefined;
    const reportNumber = await this.generateReportNumber(incidentAt);

    const report = await this.prisma.report.create({
      data: {
        reportNumber,
        reporterId,
        reportedUserId: dto.reportedUserId,
        reportedUsername: dto.reportedUsername,
        category: dto.category,
        description: dto.description,
        relatedListingId: dto.relatedListingId,
        relatedOrderId: dto.relatedOrderId,
        relatedTransactionId: dto.relatedTransactionId,
        relatedPickupId: dto.relatedPickupId,
        relatedConversationId: dto.relatedConversationId,
        incidentAt,
        context: dto.context,
        locationArea: dto.locationArea,
        evidence: dto.evidence ?? [],
        severity: dto.severity,
        contactPreference: dto.contactPreference,
      },
    });
    return report;
  }

  async listMine(reporterId: string) {
    return this.prisma.report.findMany({ where: { reporterId }, orderBy: { createdAt: 'desc' } });
  }

  // --- Admin ---

  async listAll(status?: string) {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, name: true, username: true } },
        reportedUser: { select: { id: true, name: true, username: true } },
      },
    });
  }

  async updateStatus(
    id: string,
    reviewerId: string,
    data: { status?: string; investigationNotes?: string; resolution?: string },
  ) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found.');

    return this.prisma.report.update({
      where: { id },
      data: {
        ...data,
        assignedReviewerId: reviewerId,
        resolvedAt: data.status === 'RESOLVED' || data.status === 'DISMISSED' ? new Date() : report.resolvedAt,
      },
    });
  }
}
