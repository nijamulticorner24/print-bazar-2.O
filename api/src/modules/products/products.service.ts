import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(categoryId?: string, search?: string) {
    let categoryCondition: any = undefined;
    if (categoryId) {
      categoryCondition = { categoryId };
    }

    const where: any = {
      isActive: true,
      status: 'PUBLISHED',
      ...(categoryCondition || {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
            ],
          }
        : {}),
    };

    return this.prisma.product.findMany({
      where,
      include: {
        category: {
          include: {
            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        optionGroups: {
          where: { isActive: true, isCustomerVisible: true },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        configurationRules: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        pricingSource: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getProductBySlug(slugOrId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { slug: slugOrId, status: 'PUBLISHED', isActive: true },
          { id: slugOrId, isActive: true },
        ],
      },
      include: {
        category: {
          include: {
            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        images: {
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        optionGroups: {
          where: { isActive: true },
          include: {
            options: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        configurationRules: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
        pricingMatrices: {
          orderBy: { minQty: 'asc' },
        },
        additionalPricings: {
          orderBy: [{ minQty: 'asc' }, { groupCode: 'asc' }, { optionValue: 'asc' }],
        },
        personalizationTemplate: {
          include: {
            fields: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        pricingSource: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug or ID '${slugOrId}' not found or is currently unavailable`);
    }

    return product;
  }

  async listCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            products: {
              where: { status: 'PUBLISHED', isActive: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }],
    });
  }
}
