import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SeederService implements OnModuleInit {
  private readonly logger = new Logger(SeederService.name, { timestamp: true });
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async seedAll() {
    await this.seedUsers();
  }

  async seedUsers() {
    const username = this.configService.get('SUPER_ADMIN_USERNAME');
    const email = this.configService.get('SUPER_ADMIN_EMAIL');
    let password = this.configService.get('SUPER_ADMIN_PASSWORD');

    const hashedPassword = await bcrypt.hash(password, 12);

    const findSuperAdmin = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!findSuperAdmin) {
      await this.prisma.user.create({
        data: {
          username,
          password: hashedPassword,
          email,
          phoneNumber: '+998991234567',
          firstName: 'super',
          lastName: 'admin',
          role: 'SUPERADMIN',
          isEmailVerified: true,
        },
      });
    }
    this.logger.log('Users seeders completed');

    return true;
  }

  async onModuleInit() {
    try {
      await this.seedAll();
    } catch (error) {
      this.logger.error(error);
    }
  }
}
