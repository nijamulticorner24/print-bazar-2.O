import { QualityControlService, SubmitQCDto } from './qc.service';
import { JwtPayload } from '../../common/types/roles';
export declare class QualityControlController {
    private readonly qcService;
    constructor(qcService: QualityControlService);
    getFinalQCTemplate(): import("./qc.service").QCCheckItem[];
    getChecklistsForOrder(orderId: string): Promise<({
        inspector: {
            id: string;
            fullName: string;
            role: import(".prisma/client").$Enums.UserRole;
        };
    } & {
        id: string;
        createdAt: Date;
        orderId: string;
        notes: string | null;
        type: import(".prisma/client").$Enums.QCInspectionType;
        items: import("@prisma/client/runtime/library").JsonValue;
        jobCardId: string | null;
        outcome: import(".prisma/client").$Enums.QCOutcome;
        inspectorId: string;
        defects: import(".prisma/client").$Enums.DefectCategory[];
    })[]>;
    getFinalQCQueue(): Promise<({
        customer: {
            id: string;
            email: string;
            fullName: string;
            phone: string;
        };
        items: ({
            artworkVersions: {
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.ArtworkStatus;
                storageKey: string;
                originalFileName: string;
                customerNotes: string | null;
                versionNumber: number;
                mimeType: string;
                fileSize: number;
                checksum: string;
                resolutionDpi: number | null;
                widthMm: import("@prisma/client/runtime/library").Decimal | null;
                heightMm: import("@prisma/client/runtime/library").Decimal | null;
                widthPixels: number | null;
                heightPixels: number | null;
                actualMegapixels: number | null;
                qualityStatus: string | null;
                warningAccepted: boolean;
                hasBleed: boolean | null;
                colorProfile: string | null;
                proofUrl: string | null;
                isApproved: boolean;
                prepressNotes: string | null;
                uploadedBy: string;
                approvedAt: Date | null;
                orderItemId: string;
            }[];
        } & {
            id: string;
            createdAt: Date;
            orderId: string;
            updatedAt: Date;
            sku: string;
            quantity: number;
            unitPrice: import("@prisma/client/runtime/library").Decimal;
            productId: string;
            totalPrice: import("@prisma/client/runtime/library").Decimal;
            productName: string;
            specifications: import("@prisma/client/runtime/library").JsonValue;
            approvedArtworkVersionId: string | null;
            designNotes: string | null;
        })[];
        jobCards: {
            id: string;
            createdAt: Date;
            orderId: string;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.JobCardStatus;
            priority: import(".prisma/client").$Enums.Priority;
            dueAt: Date;
            approvedArtworkVersionId: string | null;
            orderItemId: string;
            jobNumber: string;
            preHoldStatus: import(".prisma/client").$Enums.JobCardStatus | null;
            currentStation: string;
            machineId: string | null;
            operatorId: string | null;
            operationSequence: import("@prisma/client/runtime/library").JsonValue;
            technicalSpecs: import("@prisma/client/runtime/library").JsonValue;
            startedAt: Date | null;
            completedAt: Date | null;
        }[];
        qcChecklists: {
            id: string;
            createdAt: Date;
            orderId: string;
            notes: string | null;
            type: import(".prisma/client").$Enums.QCInspectionType;
            items: import("@prisma/client/runtime/library").JsonValue;
            jobCardId: string | null;
            outcome: import(".prisma/client").$Enums.QCOutcome;
            inspectorId: string;
            defects: import(".prisma/client").$Enums.DefectCategory[];
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        customerId: string;
        status: import(".prisma/client").$Enums.OrderStatus;
        subtotal: import("@prisma/client/runtime/library").Decimal;
        deliveryMethod: import(".prisma/client").$Enums.DeliveryMethod;
        discountAmount: import("@prisma/client/runtime/library").Decimal;
        orderNumber: string;
        sourceChannel: import(".prisma/client").$Enums.OrderChannel;
        customerStatus: import(".prisma/client").$Enums.CustomerVisibleStatus;
        taxAmount: import("@prisma/client/runtime/library").Decimal;
        shippingAmount: import("@prisma/client/runtime/library").Decimal;
        totalAmount: import("@prisma/client/runtime/library").Decimal;
        paidAmount: import("@prisma/client/runtime/library").Decimal;
        balanceAmount: import("@prisma/client/runtime/library").Decimal;
        paymentStatus: import(".prisma/client").$Enums.PaymentStatus;
        priority: import(".prisma/client").$Enums.Priority;
        slaStatus: import(".prisma/client").$Enums.SlaStatus;
        dueAt: Date | null;
        customerNotes: string | null;
        internalNotes: string | null;
        shippingAddressId: string | null;
        billingAddressId: string | null;
    })[]>;
    submitInspection(body: SubmitQCDto, user: JwtPayload): Promise<{
        id: string;
        createdAt: Date;
        orderId: string;
        notes: string | null;
        type: import(".prisma/client").$Enums.QCInspectionType;
        items: import("@prisma/client/runtime/library").JsonValue;
        jobCardId: string | null;
        outcome: import(".prisma/client").$Enums.QCOutcome;
        inspectorId: string;
        defects: import(".prisma/client").$Enums.DefectCategory[];
    }>;
}
