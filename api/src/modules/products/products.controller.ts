import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List all published products in catalog' })
  async listProducts(
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.listProducts(categoryId, search);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List published product categories' })
  async listCategories() {
    return this.productsService.listCategories();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get published product configuration schema and dynamic fields by slug' })
  async getProductBySlug(@Param('slug') slug: string) {
    return this.productsService.getProductBySlug(slug);
  }
}
