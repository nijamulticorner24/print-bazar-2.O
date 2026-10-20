import { Test, TestingModule } from '@nestjs/testing';
import { AdminCatalogueService } from './admin-catalogue.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';

describe('AdminCatalogueService - Product Setup Studio', () => {
  let service: AdminCatalogueService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productOptionGroup: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      productOption: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      productConfigurationRule: {
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
      productPricingSource: {
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productPricingSyncLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      pricingMatrix: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return Promise.all(callback);
      }),
    };

    audit = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminCatalogueService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<AdminCatalogueService>(AdminCatalogueService);
  });

  describe('Configuration Rules Validation', () => {
    it('should reject contradictory rules for the same condition', async () => {
      const contradictoryRules = [
        {
          name: 'Show Finishing on Matt',
          conditionGroupCode: 'paper',
          conditionOperator: 'EQUALS',
          conditionOptionValue: 'matt',
          actionType: 'SHOW',
          targetGroupCode: 'finishing',
        },
        {
          name: 'Hide Finishing on Matt',
          conditionGroupCode: 'paper',
          conditionOperator: 'EQUALS',
          conditionOptionValue: 'matt',
          actionType: 'HIDE',
          targetGroupCode: 'finishing',
        },
      ];

      jest.spyOn(service, 'getProductById').mockResolvedValue({ id: 'p1' } as any);

      await expect(
        service.saveConfigurationRules('p1', contradictoryRules as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject circular dependencies between option groups', async () => {
      const circularRules = [
        {
          name: 'Paper determines Finish',
          conditionGroupCode: 'paper',
          conditionOperator: 'EQUALS',
          conditionOptionValue: 'heavy',
          actionType: 'SHOW',
          targetGroupCode: 'finish',
        },
        {
          name: 'Finish determines Paper',
          conditionGroupCode: 'finish',
          conditionOperator: 'EQUALS',
          conditionOptionValue: 'foil',
          actionType: 'SHOW',
          targetGroupCode: 'paper',
        },
      ];

      jest.spyOn(service, 'getProductById').mockResolvedValue({ id: 'p1' } as any);

      await expect(
        service.saveConfigurationRules('p1', circularRules as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow valid non-circular conditional rules', async () => {
      const validRules = [
        {
          name: 'Show Spot UV only for Thermal Matt',
          conditionGroupCode: 'lamination',
          conditionOperator: 'EQUALS',
          conditionOptionValue: 'thermal_matt',
          actionType: 'SHOW',
          targetGroupCode: 'special_finish',
          targetOptionValue: 'spot_uv',
        },
      ];

      jest.spyOn(service, 'getProductById').mockResolvedValue({ id: 'p1' } as any);
      prisma.productConfigurationRule.create.mockResolvedValue({ id: 'r1', ...validRules[0] });

      const result = await service.saveConfigurationRules('p1', validRules as any);
      expect(result).toHaveLength(1);
      expect(prisma.productConfigurationRule.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
    });
  });

  describe('Google Sheets Pricing Synchronization & Tier Validation', () => {
    it('should reject synchronization with duplicate quantity tiers', async () => {
      jest.spyOn(service, 'getProductById').mockResolvedValue({
        id: 'p1',
        pricingSource: { id: 'ps1' },
      } as any);

      prisma.productPricingSyncLog.create.mockResolvedValue({ id: 'log1' });

      const dto = {
        manualRows: [
          { minQty: 100, maxQty: 500, unitPrice: 2.5, combination: { gsm: '350' } },
          { minQty: 100, maxQty: 500, unitPrice: 2.2, combination: { gsm: '350' } }, // Duplicate!
        ],
      };

      await expect(service.syncPricingSheet('p1', dto)).rejects.toThrow(BadRequestException);
      expect(prisma.productPricingSyncLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });

    it('should reject synchronization with invalid quantity ranges (minQty > maxQty)', async () => {
      jest.spyOn(service, 'getProductById').mockResolvedValue({
        id: 'p1',
        pricingSource: { id: 'ps1' },
      } as any);

      prisma.productPricingSyncLog.create.mockResolvedValue({ id: 'log2' });

      const dto = {
        manualRows: [
          { minQty: 500, maxQty: 100, unitPrice: 2.5 }, // Inverted!
        ],
      };

      await expect(service.syncPricingSheet('p1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject synchronization with non-positive unitPrice', async () => {
      jest.spyOn(service, 'getProductById').mockResolvedValue({
        id: 'p1',
        pricingSource: { id: 'ps1' },
      } as any);

      prisma.productPricingSyncLog.create.mockResolvedValue({ id: 'log3' });

      const dto = {
        manualRows: [
          { minQty: 100, maxQty: 500, unitPrice: -5 }, // Negative!
        ],
      };

      await expect(service.syncPricingSheet('p1', dto)).rejects.toThrow(BadRequestException);
    });

    it('should successfully sync valid quantity tiers and update pricingMatrix', async () => {
      jest.spyOn(service, 'getProductById').mockResolvedValue({
        id: 'p1',
        pricingSource: { id: 'ps1' },
      } as any);

      prisma.productPricingSyncLog.create.mockResolvedValue({ id: 'log4' });
      prisma.pricingMatrix.create.mockResolvedValue({ id: 'pm1' });
      prisma.productPricingSource.update.mockResolvedValue({ id: 'ps1' });

      const dto = {
        manualRows: [
          { minQty: 100, maxQty: 499, unitPrice: 2.5, combination: { gsm: '350' } },
          { minQty: 500, maxQty: 999, unitPrice: 2.0, combination: { gsm: '350' } },
          { minQty: 1000, maxQty: 10000, unitPrice: 1.5, combination: { gsm: '350' } },
        ],
      };

      const result = await service.syncPricingSheet('p1', dto);
      expect(result.status).toBe('SUCCESS');
      expect(result.syncedRows).toBe(3);
      expect(prisma.pricingMatrix.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
      expect(prisma.productPricingSource.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ps1' },
          data: expect.objectContaining({ syncStatus: 'SUCCESS', syncRowCount: 3 }),
        }),
      );
    });
  });

  describe('Bulk Option Builder', () => {
    it('should replace and save bulk options for a group', async () => {
      prisma.productOptionGroup.findUnique.mockResolvedValue({ id: 'g1', name: 'Paper Stock' });
      prisma.productOption.create.mockImplementation((args: any) => Promise.resolve({ id: 'opt-' + Math.random(), ...args.data }));

      const bulkDto = {
        groupId: 'g1',
        options: [
          { label: '300 GSM', value: '300_gsm', priceModifier: 0, sortOrder: 0 },
          { label: '350 GSM', value: '350_gsm', priceModifier: 0.35, sortOrder: 1 },
          { label: '400 GSM Board', value: '400_gsm', priceModifier: 0.75, sortOrder: 2 },
        ],
      };

      const saved = await service.bulkSaveOptions('g1', bulkDto as any);
      expect(saved).toHaveLength(3);
      expect(prisma.productOption.deleteMany).toHaveBeenCalledWith({ where: { groupId: 'g1' } });
    });
  });
});
