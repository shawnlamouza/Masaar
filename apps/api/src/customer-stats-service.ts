import { customerSchema, type Order } from '@masaar/contracts';
import type { CommerceRepository } from './commerce-repository.js';

/** Keeps the explainable customer indicator aligned with real lifecycle events. */
export async function applyCustomerOrderTransition(
  commerce: CommerceRepository,
  before: Order,
  after: Order,
) {
  if (before.status === after.status) return;
  const customer = (await commerce.listCustomers(after.tenantId)).find(
    (candidate) =>
      candidate.id === after.customerId || candidate.phoneNormalized === after.customerPhone,
  );
  if (!customer) return;

  const completedDelta = after.status === 'DELIVERED' && before.status !== 'DELIVERED' ? 1 : 0;
  const cancelledDelta = after.status === 'CANCELLED' && before.status !== 'CANCELLED' ? 1 : 0;
  const failedDelta = after.status === 'FAILED' && before.status !== 'FAILED' ? 1 : 0;
  let deliveredUsdMinor = 0;
  if (completedDelta) {
    if (after.currency === 'USD') deliveredUsdMinor = after.totals.grandTotal.amountMinor;
    else {
      const fx = (await commerce.listFxSnapshots(after.tenantId))[0];
      if (fx)
        deliveredUsdMinor = Math.round((after.totals.grandTotal.amountMinor / fx.lbpPerUsd) * 100);
    }
  }
  const updated = customerSchema.parse({
    ...customer,
    orderStats: {
      completedOrders: customer.orderStats.completedOrders + completedDelta,
      cancelledOrders: customer.orderStats.cancelledOrders + cancelledDelta,
      failedDeliveries: customer.orderStats.failedDeliveries + failedDelta,
      lifetimeSpendUsdMinor: customer.orderStats.lifetimeSpendUsdMinor + deliveredUsdMinor,
      lastOrderAt: after.updatedAt,
    },
    updatedAt: after.updatedAt,
  });
  await commerce.saveCustomer(updated);
}
