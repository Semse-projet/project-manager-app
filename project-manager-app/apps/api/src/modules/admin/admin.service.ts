import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@semse/db';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUsers(): Promise<any[]> {
    return await this.prisma.user.findMany({
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  async updateUserRole(userId: string, role: string): Promise<any> {
    this.logger.log(`Updating user role: ${userId} → ${role}`);
    return await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async getSystemSettings(): Promise<any> {
    return {
      maxUploadSize: 100, // MB
      apiRateLimit: 1000, // per hour
      sessionTimeout: 3600, // seconds
    };
  }

  async getAuditLog(): Promise<any[]> {
    return [
      { timestamp: new Date(), action: 'user_login', userId: 'user_1' },
      { timestamp: new Date(), action: 'draw_created', projectId: 'proj_1' },
    ];
  }
}
