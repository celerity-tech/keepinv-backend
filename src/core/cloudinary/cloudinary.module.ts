import { Module } from '@nestjs/common';

import { CloudinaryService } from './cloudinary.service';

/** Provides the Cloudinary wrapper to any module that needs to host images (products today). */
@Module({
  providers: [CloudinaryService],
  exports: [CloudinaryService],
})
export class CloudinaryModule {}
