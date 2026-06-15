import { Global, Module } from '@nestjs/common';
import { PrismaConnection } from './prisma-connection';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaConnection, PrismaService],
  exports: [PrismaConnection, PrismaService],
})
export class PrismaModule {}
