import { Module } from '@nestjs/common';

import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

// Route protection comes from the global Better Auth AuthGuard + @Roles(['admin']); the service
// provisions directly on the Better Auth Prisma client, so no extra imports are required here.
@Module({
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
