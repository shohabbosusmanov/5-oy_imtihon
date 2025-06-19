import { Global, Module } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { PrismaService } from './prisma.service';
import { RedisServcie } from './redis.service';
import { SeederModule } from './seeders/seeder.module';

@Global()
@Module({
  imports: [SeederModule],
  providers: [PrismaService, RedisServcie],
  exports: [PrismaService, RedisServcie],
})
export class DatabaseModule {}
