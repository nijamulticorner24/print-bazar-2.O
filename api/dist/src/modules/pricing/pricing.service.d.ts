import { PrismaService } from '../prisma/prisma.service';
import { ShippingGstService } from '../shipping-gst/shipping-gst.service';
export interface OptionSelectionDto {
    optionCode: string;
    valueCode: string;
}
export interface QuoteCalculationRequestDto {
    productId: string;
    quantity: number;
    options?: OptionSelectionDto[];
    fieldValues?: Record<string, any>;
    hasArtwork?: boolean;
    hasDesignService?: boolean;
    hasReferenceImage?: boolean;
    shippingPincode?: string;
    isInterState?: boolean;
    deliveryMethod?: 'COURIER' | 'STORE_PICKUP' | 'LOCAL_EXPRESS_BIKE';
    paymentMethod?: 'FULL' | 'SPLIT_50' | 'COD' | 'ONLINE';
    isCod?: boolean;
}
export interface QuoteItemBreakdown {
    startingReferenceRate?: number;
    referenceUnitPrice?: number;
    basePrice: number;
    originalBasePrice: number;
    effectiveBasePrice: number;
    quantity: number;
    baseSubtotal: number;
    optionsCost: number;
    dynamicModifiersTotal: number;
    discountAmount: number;
    discountPercent: number;
    artworkFee: number;
    designServiceFee: number;
    additionalChargesTotal?: number;
    appliedCharges?: Array<{
        chargeId: string;
        name: string;
        amount: number;
        calculationType: 'FIXED' | 'PER_UNIT' | 'PERCENTAGE';
        description?: string;
    }>;
    artworkRequirement: string;
    designServiceRequirement: string;
    referenceImageRequirement: string;
    unitPrice: number;
    subtotal: number;
    cgst: number;
    sgst: number;
    igst: number;
    totalTax: number;
    courierCharge: number;
    freeShippingThreshold: number;
    estimatedShipping: number;
    matchedZone?: {
        id: string;
        zoneName: string;
        pincodePrefix: string;
        shippingCharge: number;
    } | null;
    isFreeShippingApplied?: boolean;
    gstRatePercent?: number;
    allowCod: boolean;
    codSurcharge: number;
    codCharge: number;
    deliveryMethod: string;
    paymentMethod: string;
    grandTotal: number;
    productionDays: number;
    appliedOffer?: {
        offerId: string;
        minQty: number;
        maxQty: number;
        discountPercent: number;
        offerName: string;
        savingsAmount: number;
    } | null;
    availableOffers?: Array<{
        id: string;
        minQty: number;
        maxQty: number;
        discountPercent: number;
        unitPrice: number;
        label: string;
    }>;
    selectedOptionsSummary: Array<{
        optionName: string;
        optionCode: string;
        valueName: string;
        valueCode: string;
        priceModifier: number;
        additionalUnitPrice?: number;
        additionalChargeTotal?: number;
    }>;
    specificationsSnapshot: Record<string, any>;
}
export declare class PricingService {
    private readonly prisma;
    private readonly shippingGstService;
    constructor(prisma: PrismaService, shippingGstService: ShippingGstService);
    calculateQuote(dto: QuoteCalculationRequestDto): Promise<QuoteItemBreakdown>;
}
