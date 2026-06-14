import { Module } from '@nestjs/common';

import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

// Guards rely on the globally-registered passport 'jwt' strategy (AuthModule) and the
// global Reflector, so no extra imports are required here.
@Module({
  controllers: [PlatformController],
  providers: [PlatformService],
})
export class PlatformModule {}
