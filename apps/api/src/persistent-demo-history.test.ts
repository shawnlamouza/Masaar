import { describe, expect, it } from 'vitest';
import { InMemoryCommerceRepository } from './commerce-repository.js';
import { InMemoryFulfillmentRepository } from './fulfillment-repository.js';
import { InMemoryInventoryRepository } from './inventory-repository.js';
import { InMemoryOrderRepository } from './order-repository.js';
import { seedPersistentDemoHistory } from './persistent-demo-history.js';

describe('persistent demonstration history', () => {
  it('creates traceable operating records once and remains idempotent', async () => {
    const repositories = {
      commerceRepository: new InMemoryCommerceRepository(),
      orderRepository: new InMemoryOrderRepository(),
      fulfillmentRepository: new InMemoryFulfillmentRepository(),
      inventoryRepository: new InMemoryInventoryRepository(),
    };

    await expect(seedPersistentDemoHistory(repositories)).resolves.toMatchObject({ created: 30 });
    await expect(seedPersistentDemoHistory(repositories)).resolves.toMatchObject({ created: 0 });

    const tenantId = 'tenant_cedar_thread';
    const unavailable = await repositories.orderRepository.get(tenantId, 'ord_history_022');
    const delivery = await repositories.fulfillmentRepository.getDeliveryForOrder(
      tenantId,
      'ord_history_022',
    );
    expect(unavailable).toMatchObject({ status: 'FAILED' });
    expect(delivery?.attempts.at(-1)).toMatchObject({
      status: 'FAILED',
      failureReason: 'CUSTOMER_UNAVAILABLE',
    });
    expect(await repositories.fulfillmentRepository.listPaymentEntries(tenantId)).not.toHaveLength(0);
    expect(await repositories.inventoryRepository.listMovements(tenantId)).not.toHaveLength(0);
    expect(await repositories.inventoryRepository.listReturns(tenantId)).toContainEqual(
      expect.objectContaining({ id: 'ret_history_019', status: 'RESOLVED' }),
    );
    expect(await repositories.fulfillmentRepository.listReconciliations(tenantId)).toContainEqual(
      expect.objectContaining({ id: 'rec_history_cash', status: 'CLOSED' }),
    );
  });
});
