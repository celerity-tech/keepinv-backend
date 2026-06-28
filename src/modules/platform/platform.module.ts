import { Module } from '@nestjs/common';

import { CloudinaryModule } from '../../core/cloudinary/cloudinary.module';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

// Route protection comes from the global Better Auth AuthGuard + @Roles(['admin']); the service
// provisions directly on the Better Auth Prisma client. CloudinaryModule is imported so a tenant
// wipe can purge that org's hosted product images alongside its database rows.
@Module({
  imports: [CloudinaryModule],
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
