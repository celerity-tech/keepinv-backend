import { Module, ValidationPipe } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';

import { AuthModule } from '@thallesp/nestjs-better-auth';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RateLimitModule } from './core/security/rate-limit.module';
import { HealthModule } from './core/health/health.module';
import { auth } from './core/auth/auth';
import { PlatformModule } from './modules/platform/platform.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/database/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductUnitModule } from './modules/product-unit/product-unit.module';
import { StockMovementsModule } from './modules/stock-movements/stock-movements.module';
import { StockMovementTypesModule } from './modules/stock-movement-types/stock-movement-types.module';
import { InventoryAuditModule } from './modules/inventory-audit/inventory-audit.module';
import { PosModule } from './modules/pos/pos.module';
import { ReceiptImportsModule } from './modules/receipt-imports/receipt-imports.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    RateLimitModule,
    HealthModule,
    PrismaModule,
    UsersModule,
    CategoriesModule,
    SuppliersModule,
    LocationsModule,
    ProductsModule,
    ProductUnitModule,
    StockMovementsModule,
    StockMovementTypesModule,
    InventoryAuditModule,
    PosModule,
    ReceiptImportsModule,
    PlatformModule,
    EntitlementsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
