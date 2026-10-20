import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AdminCatalogueService } from './admin-catalogue.service';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ProductsController, AdminCatalogueController],
  providers: [ProductsService, AdminCatalogueService],
  exports: [ProductsService, AdminCatalogueService],
})
export class ProductsModule {}
