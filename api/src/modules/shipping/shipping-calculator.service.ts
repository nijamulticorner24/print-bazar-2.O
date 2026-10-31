import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShippingConfigService } from './shipping-config.service';
import { ShippingPackagingService } from './shipping-packaging.service';
import { ShippingCalculationRequestDto } from './dto/shipping.dto';

export interface AuthoritativeShippingBreakdown {
  status: 'CALCULATED' | 'FREE' | 'STORE_PICKUP' | 'NON_SERVICEABLE' | 'PENDING';
  destinationPincode: string;
  isServiceable: boolean;
  serviceabilityMessage?: string;
  zone: {
    id: string;
    code: string;
    name: string;
    estimatedDeliveryDays?: string;
  } | null;
  pricingModelUsed: string;
  matchedBracketLabel?: string;
  unitWeightGrams: number;
  productWeightGrams: number;
  packaging: {
    id?: string;
    name: string;
    weightGrams: number;
    packagingCharge: number;
  };
  actualWeightGrams: number;
  volumetricWeightGrams: number | null;
  billableWeightGrams: number;
  rateCard: {
    id?: string;
    name: string;
  } | null;
  matchedSlab: {
    id?: string;
    minWeightGrams: number;
    maxWeightGrams: number;
    rate: number;
  } | null;
  baseShippingCharge: number;
  additionalWeightCharge: number;
  zoneSurcharge: number;
  pincodeSurcharge: number;
  packagingCharge: number;
  isFreeShippingApplied: boolean;
  freeShippingThreshold: number;
  finalShippingAmount: number;
  deliveryMethod: string;
  calculationBasis: string;
}

@Injectable()
export class ShippingCalculatorService {
  private readonly logger = new Logger(ShippingCalculatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ShippingConfigService,
    private readonly packagingService: ShippingPackagingService,
  ) {}

  async calculateShipping(dto: ShippingCalculationRequestDto): Promise<AuthoritativeShippingBreakdown> {
    const config = await this.configService.getConfiguration();
    const deliveryMethod = dto.deliveryMethod || 'COURIER';
    const cleanPin = (dto.destinationPincode || '').trim().replace(/[^0-9]/g, '');

    // 1. Store Pickup fast path
    if (deliveryMethod === 'STORE_PICKUP') {
      return {
        status: 'STORE_PICKUP',
        destinationPincode: cleanPin,
        isServiceable: true,
        zone: null,
        pricingModelUsed: 'FIXED',
        unitWeightGrams: 0,
        productWeightGrams: 0,
        packaging: { name: 'Customer Plant Pickup', weightGrams: 0, packagingCharge: 0 },
        actualWeightGrams: 0,
        volumetricWeightGrams: null,
        billableWeightGrams: 0,
        rateCard: null,
        matchedSlab: null,
        baseShippingCharge: 0,
        additionalWeightCharge: 0,
        zoneSurcharge: 0,
        pincodeSurcharge: 0,
        packagingCharge: 0,
        isFreeShippingApplied: true,
        freeShippingThreshold: Number(config.freeShippingThreshold),
        finalShippingAmount: 0,
        deliveryMethod: 'STORE_PICKUP',
        calculationBasis: 'Plant Store Pickup (₹0)',
      };
    }

    // 2. Resolve Product & Weight Configuration
    let product: any = null;
    if (dto.productId) {
      product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        include: { packagingProfile: true },
      });
    }

    let productWeightGrams = 0;
    let unitWeightGrams = 2.0; // Standard default 2.0g per piece
    let pricingModelUsed = product?.pricingModel || 'MATRIX';
    let matchedBracketLabel: string | undefined = undefined;

    const requestedQty = Math.max(1, Number(dto.quantity) || 1);

    if (dto.customUnitWeightGrams !== undefined && dto.customUnitWeightGrams > 0) {
      unitWeightGrams = Number(dto.customUnitWeightGrams);
      productWeightGrams = Math.round(requestedQty * unitWeightGrams * 100) / 100;
    } else if (product) {
      const isBulkRange = pricingModelUsed === 'BULK_RANGE';

      if (isBulkRange) {
        // MODEL B: BULK_QUANTITY_RANGE
        // Total product weights are configured per discrete quantity tier in Stage 5 Product Base Price by Quantity
        const bulkWeights = Array.isArray(product.bulkTierWeights) ? product.bulkTierWeights : [];
        const sorted = [...bulkWeights].sort((a: any, b: any) => Number(a.minQty || 0) - Number(b.minQty || 0));

        // 1. Exact quantity tier match
        const exactMatch = sorted.find((b: any) => Number(b.minQty) === requestedQty);
        if (exactMatch && (Number(exactMatch.totalProductWeightGrams) > 0 || Number(exactMatch.unitWeightGrams) > 0)) {
          const totalW = Number(exactMatch.totalProductWeightGrams ?? exactMatch.unitWeightGrams);
          // CRITICAL: Do NOT multiply configured bulk tier weight by order quantity again!
          productWeightGrams = Math.round(totalW * 100) / 100;
          unitWeightGrams = Math.round((totalW / requestedQty) * 1000) / 1000;
          matchedBracketLabel = `${exactMatch.minQty} pcs (${productWeightGrams}g total)`;
        } else {
          // 2. Incremental or range match
          const bracketMatch = sorted.find((b: any) => {
            const minQ = Number(b.minQty || 0);
            const maxQ = b.maxQty ? Number(b.maxQty) : Infinity;
            return requestedQty >= minQ && requestedQty <= maxQ;
          }) || (sorted.length > 0 ? sorted[sorted.length - 1] : null);

          if (bracketMatch && (Number(bracketMatch.totalProductWeightGrams) > 0 || Number(bracketMatch.unitWeightGrams) > 0)) {
            const baseTierWeight = Number(bracketMatch.totalProductWeightGrams ?? bracketMatch.unitWeightGrams);
            const baseTierQty = Math.max(1, Number(bracketMatch.minQty || 1));
            // Explicit weight resolution rule for arbitrary incremental quantities: scale proportionally from matched base tier
            const effectiveUnitRate = baseTierWeight / baseTierQty;
            productWeightGrams = Math.round(requestedQty * effectiveUnitRate * 100) / 100;
            unitWeightGrams = Math.round(effectiveUnitRate * 1000) / 1000;
            matchedBracketLabel = `${bracketMatch.minQty} pcs tier (${productWeightGrams}g scaled)`;
          } else {
            // Fallback to product.unitWeightGrams if no bulk tier configured
            unitWeightGrams = Number(product.unitWeightGrams) > 0 ? Number(product.unitWeightGrams) : 2.0;
            productWeightGrams = Math.round(requestedQty * unitWeightGrams * 100) / 100;
          }
        }
      } else {
        // MODEL A: SINGLE_FIXED_QUANTITY
        // Admin enters one weight per printed piece (unitWeightGrams).
        // Total Product Weight = Actual Order Quantity × Weight Per Piece
        unitWeightGrams = Number(product.unitWeightGrams) > 0 ? Number(product.unitWeightGrams) : 2.0;
        productWeightGrams = Math.round(requestedQty * unitWeightGrams * 100) / 100;
        matchedBracketLabel = `${requestedQty} pcs @ ${unitWeightGrams}g/pc`;
      }
    } else {
      productWeightGrams = Math.round(requestedQty * unitWeightGrams * 100) / 100;
    }

    // 3. Resolve Packaging Profile
    let packagingProfile: any = null;
    if (dto.packagingProfileId) {
      packagingProfile = await this.packagingService.getProfile(dto.packagingProfileId).catch(() => null);
    } else if (product?.packagingProfile) {
      packagingProfile = {
        ...product.packagingProfile,
        packagingCharge: Number(product.packagingProfile.packagingCharge),
      };
    } else {
      packagingProfile = await this.packagingService.getDefaultProfile();
    }

    const packagingWeightGrams = packagingProfile
      ? Number(packagingProfile.weightGrams)
      : Number(config.defaultPackagingWeightGrams || 200);
    const packagingCharge = packagingProfile ? Number(packagingProfile.packagingCharge || 0) : 0;

    // Actual Shipment Weight = Product Weight + Packaging Weight (added once per shipment)
    const actualWeightGrams = Math.round((productWeightGrams + packagingWeightGrams) * 100) / 100;

    // 4. Volumetric Weight Calculation
    let volumetricWeightGrams: number | null = null;
    if (config.isVolumetricEnabled && packagingProfile?.lengthMm && packagingProfile?.widthMm && packagingProfile?.heightMm) {
      const divisor = Number(config.volumetricDivisor || 5000);
      const lCm = packagingProfile.lengthMm / 10;
      const wCm = packagingProfile.widthMm / 10;
      const hCm = packagingProfile.heightMm / 10;
      // Formula: (L cm * W cm * H cm) / Divisor = Volumetric Weight in Kg
      const volKg = (lCm * wCm * hCm) / divisor;
      volumetricWeightGrams = Math.round(volKg * 1000 * 100) / 100;
    }

    // Billable Weight = Maximum of actual and volumetric
    const billableWeightGrams = volumetricWeightGrams
      ? Math.max(actualWeightGrams, volumetricWeightGrams)
      : actualWeightGrams;

    // 5. Destination Pincode & Delivery Zone Resolution
    if (!cleanPin || cleanPin.length !== 6) {
      return {
        status: 'PENDING',
        destinationPincode: cleanPin,
        isServiceable: false,
        serviceabilityMessage: 'Please enter a valid 6-digit Indian PIN code to calculate shipping',
        zone: null,
        pricingModelUsed,
        matchedBracketLabel,
        unitWeightGrams,
        productWeightGrams,
        packaging: {
          id: packagingProfile?.id,
          name: packagingProfile?.name || 'Standard Carton',
          weightGrams: packagingWeightGrams,
          packagingCharge,
        },
        actualWeightGrams,
        volumetricWeightGrams,
        billableWeightGrams,
        rateCard: null,
        matchedSlab: null,
        baseShippingCharge: 0,
        additionalWeightCharge: 0,
        zoneSurcharge: 0,
        pincodeSurcharge: 0,
        packagingCharge,
        isFreeShippingApplied: false,
        freeShippingThreshold: Number(config.freeShippingThreshold),
        finalShippingAmount: 0,
        deliveryMethod: 'COURIER',
        calculationBasis: 'Pincode required for authoritative courier quote',
      };
    }

    let resolvedZone: any = null;
    let pincodeSurcharge = 0;
    let isServiceable = true;
    let serviceabilityMessage: string | undefined = undefined;

    // Direct 6-digit pincode database lookup
    const pinRecord = await this.prisma.shippingPincode.findUnique({
      where: { pincode: cleanPin },
      include: { zone: true },
    });

    if (pinRecord) {
      if (!pinRecord.isServiceable) {
        return {
          status: 'NON_SERVICEABLE',
          destinationPincode: cleanPin,
          isServiceable: false,
          serviceabilityMessage: `PIN code ${cleanPin} (${pinRecord.city}, ${pinRecord.state}) is currently non-serviceable for courier delivery.`,
          zone: {
            id: pinRecord.zone.id,
            code: pinRecord.zone.zoneCode || 'CUSTOM',
            name: pinRecord.zone.zoneName,
            estimatedDeliveryDays: pinRecord.zone.estimatedDeliveryDays || undefined,
          },
          pricingModelUsed,
          matchedBracketLabel,
          unitWeightGrams,
          productWeightGrams,
          packaging: {
            id: packagingProfile?.id,
            name: packagingProfile?.name || 'Standard Carton',
            weightGrams: packagingWeightGrams,
            packagingCharge,
          },
          actualWeightGrams,
          volumetricWeightGrams,
          billableWeightGrams,
          rateCard: null,
          matchedSlab: null,
          baseShippingCharge: 0,
          additionalWeightCharge: 0,
          zoneSurcharge: 0,
          pincodeSurcharge: 0,
          packagingCharge,
          isFreeShippingApplied: false,
          freeShippingThreshold: Number(config.freeShippingThreshold),
          finalShippingAmount: 0,
          deliveryMethod: 'COURIER',
          calculationBasis: 'PIN code not serviceable for delivery',
        };
      }
      resolvedZone = pinRecord.zone;
      pincodeSurcharge = Number(pinRecord.additionalSurcharge || 0);
    } else {
      // Zone fallback: prefix match or default NATIONAL
      const allZones = await this.prisma.shippingZone.findMany({ where: { isActive: true } });
      const prefixMatch = allZones.find((z) => z.pincodePrefix && cleanPin.startsWith(z.pincodePrefix));
      if (prefixMatch) {
        resolvedZone = prefixMatch;
      } else {
        resolvedZone =
          allZones.find((z) => z.zoneCode === 'NATIONAL') ||
          allZones[0];
      }
    }

    if (!resolvedZone) {
      throw new BadRequestException('No active shipping zone configured for destination');
    }

    const zoneSurcharge = Number(resolvedZone.zoneSurcharge || 0);

    // 6. Rate Card & Slab Matching
    const rateCard = await this.prisma.shippingRateCard.findFirst({
      where: {
        zoneId: resolvedZone.id,
        isActive: true,
      },
      include: {
        slabs: { orderBy: { minWeightGrams: 'asc' } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    let baseShippingCharge = Number(resolvedZone.shippingCharge || 100);
    let additionalWeightCharge = 0;
    let matchedSlabInfo: AuthoritativeShippingBreakdown['matchedSlab'] = null;
    let rateCardInfo: AuthoritativeShippingBreakdown['rateCard'] = null;

    if (rateCard && rateCard.slabs.length > 0) {
      rateCardInfo = { id: rateCard.id, name: rateCard.name };
      const slabs = rateCard.slabs;
      const highestSlab = slabs[slabs.length - 1];

      // Match slab where billableWeightGrams <= slab.maxWeightGrams
      const matchedSlab = slabs.find((s) => billableWeightGrams <= s.maxWeightGrams);

      if (matchedSlab) {
        baseShippingCharge = Number(matchedSlab.rate);
        matchedSlabInfo = {
          id: matchedSlab.id,
          minWeightGrams: matchedSlab.minWeightGrams,
          maxWeightGrams: matchedSlab.maxWeightGrams,
          rate: Number(matchedSlab.rate),
        };
      } else {
        // Exceeds highest slab -> calculate additional weight per kg
        baseShippingCharge = Number(highestSlab.rate);
        matchedSlabInfo = {
          id: highestSlab.id,
          minWeightGrams: highestSlab.minWeightGrams,
          maxWeightGrams: highestSlab.maxWeightGrams,
          rate: Number(highestSlab.rate),
        };

        const extraGrams = billableWeightGrams - highestSlab.maxWeightGrams;
        const extraKg = Math.ceil(extraGrams / 1000);
        additionalWeightCharge = Math.round(extraKg * Number(rateCard.additionalWeightPerKg || 25) * 100) / 100;
      }
    }

    // Subtotal before free shipping check
    let calculatedShipping =
      baseShippingCharge + additionalWeightCharge + zoneSurcharge + pincodeSurcharge + packagingCharge;

    const minCharge = Number(config.minShippingCharge || 40);
    calculatedShipping = Math.max(minCharge, calculatedShipping);

    // 7. Free Shipping Threshold Check
    const orderSubtotal = Math.max(0, Number(dto.orderSubtotal || 0));
    const freeThreshold = Number(config.freeShippingThreshold || 2000);
    const isFreeEligible = config.isFreeShippingEnabled && freeThreshold > 0 && orderSubtotal >= freeThreshold;

    let finalShippingAmount = isFreeEligible ? 0 : calculatedShipping;
    finalShippingAmount = Math.round(finalShippingAmount * 100) / 100;

    const basisParts = [
      `Zone: ${resolvedZone.zoneName}`,
      matchedSlabInfo ? `Slab: Up to ${(matchedSlabInfo.maxWeightGrams / 1000).toFixed(1)}kg (₹${baseShippingCharge})` : `Base Rate (₹${baseShippingCharge})`,
    ];
    if (additionalWeightCharge > 0) {
      basisParts.push(`Extra Weight: +₹${additionalWeightCharge}`);
    }
    if (zoneSurcharge > 0) {
      basisParts.push(`Zone Surcharge: +₹${zoneSurcharge}`);
    }
    if (pincodeSurcharge > 0) {
      basisParts.push(`Pincode Surcharge: +₹${pincodeSurcharge}`);
    }
    if (packagingCharge > 0) {
      basisParts.push(`Packaging: +₹${packagingCharge}`);
    }
    if (isFreeEligible) {
      basisParts.push(`Free Shipping Applied (Subtotal ≥ ₹${freeThreshold})`);
    }

    return {
      status: isFreeEligible ? 'FREE' : 'CALCULATED',
      destinationPincode: cleanPin,
      isServiceable: true,
      serviceabilityMessage: pinRecord ? `Serviceable delivery to ${pinRecord.city}, ${pinRecord.state}` : `Standard courier coverage for PIN ${cleanPin}`,
      zone: {
        id: resolvedZone.id,
        code: resolvedZone.zoneCode || 'CUSTOM',
        name: resolvedZone.zoneName,
        estimatedDeliveryDays: resolvedZone.estimatedDeliveryDays || undefined,
      },
      pricingModelUsed,
      matchedBracketLabel,
      unitWeightGrams,
      productWeightGrams,
      packaging: {
        id: packagingProfile?.id,
        name: packagingProfile?.name || 'Standard Carton',
        weightGrams: packagingWeightGrams,
        packagingCharge,
      },
      actualWeightGrams,
      volumetricWeightGrams,
      billableWeightGrams,
      rateCard: rateCardInfo,
      matchedSlab: matchedSlabInfo,
      baseShippingCharge,
      additionalWeightCharge,
      zoneSurcharge,
      pincodeSurcharge,
      packagingCharge,
      isFreeShippingApplied: isFreeEligible,
      freeShippingThreshold: freeThreshold,
      finalShippingAmount,
      deliveryMethod: 'COURIER',
      calculationBasis: basisParts.join(' • '),
    };
  }

  async checkServiceability(pincode: string) {
    const cleanPin = pincode.trim().replace(/[^0-9]/g, '');
    if (cleanPin.length !== 6) {
      throw new BadRequestException('Pincode must be 6 digits');
    }

    const pinRecord = await this.prisma.shippingPincode.findUnique({
      where: { pincode: cleanPin },
      include: {
        zone: {
          select: {
            id: true,
            zoneCode: true,
            zoneName: true,
            estimatedDeliveryDays: true,
          },
        },
      },
    });

    if (pinRecord) {
      return {
        pincode: cleanPin,
        city: pinRecord.city,
        state: pinRecord.state,
        zone: pinRecord.zone,
        isServiceable: pinRecord.isServiceable,
        estimatedDays: pinRecord.estimatedDays || pinRecord.zone.estimatedDeliveryDays || '2-4 business days',
        additionalSurcharge: Number(pinRecord.additionalSurcharge || 0),
        message: pinRecord.isServiceable
          ? `Delivery available to ${pinRecord.city}, ${pinRecord.state}`
          : `Delivery not currently available to ${pinRecord.city}, ${pinRecord.state}`,
      };
    }

    // Default pan-India serviceability fallback
    return {
      pincode: cleanPin,
      city: 'India',
      state: '',
      zone: {
        id: 'national',
        zoneCode: 'NATIONAL',
        zoneName: 'National Delivery',
        estimatedDeliveryDays: '3-5 business days',
      },
      isServiceable: true,
      estimatedDays: '3-5 business days',
      additionalSurcharge: 0,
      message: `Standard national courier coverage available for ${cleanPin}`,
    };
  }
}
