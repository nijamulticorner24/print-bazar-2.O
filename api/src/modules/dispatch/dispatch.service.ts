import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus, ShipmentStatus } from '@prisma/client';

export interface CourierHandoverDto {
  orderId: string;
  courierName: string;
  manifestReference?: string;
  scannedBarcodes: string[];
}

export interface StorePickupHandoverDto {
  orderId: string;
  collectorName: string;
  collectorPhone: string;
  idProofType?: string;
  idProofNumber?: string;
  notes?: string;
}

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Courier Dispatch Handover:
   * Scans package barcodes, checks manifest, updates shipment to IN_TRANSIT, order to OUT_FOR_DELIVERY
   */
  async confirmCourierHandover(dto: CourierHandoverDto, staffId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: dto.orderId },
          { orderNumber: dto.orderId },
        ],
      },
      include: {
        packages: { include: { shipment: true } },
      },
    });

    if (!order) throw new NotFoundException(`Order '${dto.orderId}' not found`);

    if (order.status !== OrderStatus.READY_FOR_DISPATCH) {
      throw new BadRequestException(
        `Order must be in 'READY_FOR_DISPATCH' state to perform courier handover (Current: ${order.status}).`,
      );
    }

    // Verify all packages are scanned
    const orderBarcodes = new Set(order.packages.map((p) => p.barcode));
    for (const barcode of dto.scannedBarcodes) {
      if (!orderBarcodes.has(barcode)) {
        throw new BadRequestException(`Scanned barcode '${barcode}' does not belong to Order ${order.orderNumber}.`);
      }
    }

    if (dto.scannedBarcodes.length < order.packages.length) {
      throw new BadRequestException(
        `Incomplete scan: Scanned ${dto.scannedBarcodes.length} of ${order.packages.length} packages.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Advance Order status to OUT_FOR_DELIVERY
      const res = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.OUT_FOR_DELIVERY,
          customerStatus: 'OUT_FOR_DELIVERY',
        },
      });

      // 2. Update Shipment status to IN_TRANSIT
      const shipmentId = order.packages[0]?.shipmentId;
      if (shipmentId) {
        await tx.shipment.update({
          where: { id: shipmentId },
          data: {
            status: ShipmentStatus.IN_TRANSIT,
            dispatchedAt: new Date(),
          },
        });
      }

      // 3. Status History
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.OUT_FOR_DELIVERY,
          changedById: staffId,
          reason: `Handed over to ${dto.courierName}. Manifest: ${dto.manifestReference || 'N/A'}.`,
        },
      });

      return res;
    });

    await this.auditService.log({
      actorId: staffId,
      action: 'COURIER_HANDOVER_DISPATCH',
      entity: 'Order',
      entityId: order.id,
      orderId: order.id,
      newState: { status: OrderStatus.OUT_FOR_DELIVERY, courier: dto.courierName },
      reason: `Courier handover confirmed with ${dto.scannedBarcodes.length} packages.`,
    });

    this.eventEmitter.emit('dispatch.confirmed', {
      orderId: order.id,
      courierName: dto.courierName,
    });

    return updated;
  }

  /**
   * Counter Store Pickup Handover:
   * Mandatory check for unpaid balance; verifies collector identity; transitions order directly to DELIVERED
   */
  async confirmStorePickup(dto: StorePickupHandoverDto, staffId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        OR: [
          { id: dto.orderId },
          { orderNumber: dto.orderId },
        ],
      },
    });

    if (!order) throw new NotFoundException(`Order '${dto.orderId}' not found`);

    if (order.status !== OrderStatus.READY_FOR_DISPATCH) {
      throw new BadRequestException(
        `Order must be in 'READY_FOR_DISPATCH' state for pickup handover (Current: ${order.status}).`,
      );
    }

    // Strict Financial Check: Block release if outstanding balance exists
    const balance = Number(order.balanceAmount);
    if (balance > 0) {
      throw new BadRequestException(
        `Store Pickup BLOCKED: Outstanding balance of ₹${balance.toFixed(2)} must be settled at counter first.`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DELIVERED,
          customerStatus: 'DELIVERED',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERED,
          changedById: staffId,
          reason: `Store Pickup Collected by ${dto.collectorName} (Phone: ${dto.collectorPhone}).`,
          notes: dto.notes,
        },
      });

      return res;
    });

    await this.auditService.log({
      actorId: staffId,
      action: 'STORE_PICKUP_HANDOVER',
      entity: 'Order',
      entityId: order.id,
      orderId: order.id,
      newState: { status: OrderStatus.DELIVERED, collector: dto.collectorName, phone: dto.collectorPhone },
      reason: `Store pickup completed by ${dto.collectorName}`,
    });

    this.eventEmitter.emit('delivery.confirmed', {
      orderId: order.id,
      method: 'STORE_PICKUP',
      collectorName: dto.collectorName,
    });

    return updated;
  }

  /**
   * Confirm Courier Delivery (e.g. via courier webhook or manual POD confirmation)
   */
  async confirmCourierDelivery(orderId: string, receiverName?: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order '${orderId}' not found`);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          customerStatus: 'DELIVERED',
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: OrderStatus.DELIVERED,
          reason: `Delivered to recipient: ${receiverName || 'Customer'}`,
        },
      });

      return updated;
    });
  }
}
