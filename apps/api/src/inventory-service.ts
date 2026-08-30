import { randomUUID } from 'node:crypto';
import {
  inventoryMovementSchema,
  type InventoryMovement,
  type Order,
  type Product,
} from '@masaar/contracts';
import type { InventoryRepository } from './inventory-repository.js';

type Actor = { userId: string; displayName?: string };

export function inventoryBalances(movements: InventoryMovement[]) {
  const result = new Map<string, { onHand: number; reserved: number }>();
  for (const movement of movements) {
    const current = result.get(movement.variantId) ?? { onHand: 0, reserved: 0 };
    current.onHand += movement.onHandDelta;
    current.reserved += movement.reservedDelta;
    result.set(movement.variantId, current);
  }
  return result;
}

async function appendOnce(
  inventory: InventoryRepository,
  movement: Omit<InventoryMovement, 'id' | 'createdAt'> & { createdAt?: string },
) {
  const existing = await inventory.findMovementByKey(movement.tenantId, movement.idempotencyKey);
  if (existing) return existing;
  const parsed = inventoryMovementSchema.parse({
    ...movement,
    id: `mov_${randomUUID()}`,
    createdAt: movement.createdAt ?? new Date().toISOString(),
  });
  await inventory.saveMovement(parsed);
  return parsed;
}

export async function ensureOpeningMovements(
  tenantId: string,
  products: Product[],
  inventory: InventoryRepository,
) {
  for (const product of products.filter((item) => item.trackStock)) {
    for (const variant of product.variants) {
      if (variant.stockOnHand === undefined) continue;
      await appendOnce(inventory, {
        tenantId,
        productId: product.id,
        productName: product.name,
        variantId: variant.id,
        sku: variant.sku,
        type: 'OPENING',
        quantity: Math.max(1, variant.stockOnHand || 1),
        onHandDelta: variant.stockOnHand,
        reservedDelta: 0,
        locationId: 'main',
        sourceType: 'OPENING',
        sourceId: product.id,
        reason: 'Opening balance imported from the product catalog.',
        unitCost: variant.currentUnitCost,
        idempotencyKey: `opening:${variant.id}`,
        createdBy: 'system',
      });
    }
  }
}

const reservingStatuses: Order['status'][] = [
  'CONFIRMED',
  'PREPARING',
  'PACKED',
  'READY_FOR_DISPATCH',
  'ASSIGNED_TO_DELIVERY',
  'OUT_FOR_DELIVERY',
  'FAILED',
];

export async function synchronizeOrderInventory(
  order: Order,
  products: Product[],
  inventory: InventoryRepository,
  actor: Actor,
) {
  await ensureOpeningMovements(order.tenantId, products, inventory);
  const variants = new Map(
    products.flatMap((product) =>
      product.variants.map((variant) => [variant.id, { product, variant }] as const),
    ),
  );
  const movements = await inventory.listMovements(order.tenantId);
  const balances = inventoryBalances(movements);
  const shouldReserve = reservingStatuses.includes(order.status);
  const shouldSell = ['DELIVERED', 'RETURNED', 'REFUNDED'].includes(order.status);

  for (const line of order.items) {
    const catalog = variants.get(line.variantId);
    if (!catalog?.product.trackStock) continue;
    const reserveKey = `order:${order.id}:${line.id}:reserve`;
    const releaseKey = `order:${order.id}:${line.id}:release`;
    const saleKey = `order:${order.id}:${line.id}:sale`;
    const reserved = movements.some((item) => item.idempotencyKey === reserveKey);
    const released = movements.some((item) => item.idempotencyKey === releaseKey);
    const sold = movements.some((item) => item.idempotencyKey === saleKey);

    if (shouldReserve && !reserved) {
      const balance = balances.get(line.variantId) ?? { onHand: 0, reserved: 0 };
      const available = balance.onHand - balance.reserved;
      if (available < line.quantity) {
        throw Object.assign(
          new Error(
            `${line.sku} has ${available} available, but ${line.quantity} are required. Receive stock, reduce the order, or cancel it.`,
          ),
          { statusCode: 409, code: 'INSUFFICIENT_STOCK' },
        );
      }
      await appendOnce(inventory, {
        tenantId: order.tenantId,
        productId: line.productId,
        productName: line.productName,
        variantId: line.variantId,
        sku: line.sku,
        type: 'RESERVATION',
        quantity: line.quantity,
        onHandDelta: 0,
        reservedDelta: line.quantity,
        locationId: 'main',
        sourceType: 'ORDER',
        sourceId: order.id,
        reason: `Reserved for ${order.orderNumber}.`,
        idempotencyKey: reserveKey,
        createdBy: actor.userId,
      });
      balance.reserved += line.quantity;
      balances.set(line.variantId, balance);
    }

    if (order.status === 'CANCELLED' && reserved && !released && !sold) {
      await appendOnce(inventory, {
        tenantId: order.tenantId,
        productId: line.productId,
        productName: line.productName,
        variantId: line.variantId,
        sku: line.sku,
        type: 'RESERVATION_RELEASE',
        quantity: line.quantity,
        onHandDelta: 0,
        reservedDelta: -line.quantity,
        locationId: 'main',
        sourceType: 'ORDER',
        sourceId: order.id,
        reason: `Released after ${order.orderNumber} was cancelled.`,
        idempotencyKey: releaseKey,
        createdBy: actor.userId,
      });
    }

    if (shouldSell && !sold) {
      await appendOnce(inventory, {
        tenantId: order.tenantId,
        productId: line.productId,
        productName: line.productName,
        variantId: line.variantId,
        sku: line.sku,
        type: 'SALE',
        quantity: line.quantity,
        onHandDelta: -line.quantity,
        reservedDelta: reserved && !released ? -line.quantity : 0,
        locationId: 'main',
        sourceType: 'ORDER',
        sourceId: order.id,
        reason: `Stock finalized for delivered order ${order.orderNumber}.`,
        unitCost: line.unitCost,
        idempotencyKey: saleKey,
        createdBy: actor.userId,
      });
    }
  }
}

export async function synchronizeTenantInventory(
  tenantId: string,
  products: Product[],
  orders: Order[],
  inventory: InventoryRepository,
) {
  await ensureOpeningMovements(tenantId, products, inventory);
  for (const order of orders) {
    await synchronizeOrderInventory(order, products, inventory, { userId: 'system' });
  }
}

export async function addInventoryMovement(
  inventory: InventoryRepository,
  input: Omit<InventoryMovement, 'id' | 'createdAt'> & { createdAt?: string },
) {
  return appendOnce(inventory, input);
}
