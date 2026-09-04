import sql from 'mssql';

const TENANT_ID = 'tenant_cedar_thread';
const BASELINE_CUTOFF = '2026-09-03T09:00:00.000Z';

const ids = {
  ritaOrder: 'ord_b64cad3e-f13c-4aa7-a4be-e9a5b32e0c6e',
  ritaDelivery: 'del_c9600ef8-9dc3-4da5-af8f-e8e49488bfad',
  fadiOrder: 'ord_0c60ff5f-9b83-4c43-8fb8-7a822610e6e6',
  fadiCustomer: 'cus_ead29f9d-1bb1-4625-91e2-b46f9f623e2b',
  fadiDelivery: 'del_cd05f71f-2a08-4129-89f2-6489ee24803c',
  fadiCommand: 'b27c7620-3720-4d6b-a70d-0f607a979a6e',
  addedOrder: 'ord_82e39306-f3f8-492d-a184-84a8ef7cb8d9',
  addedCustomer: 'cus_b6b9d17f-6d67-49d2-b21a-659859ac884a',
} as const;

type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The staging aggregate is not a JSON object.');
  return value as JsonRecord;
}

function array(value: unknown) {
  if (!Array.isArray(value)) throw new Error('The staging aggregate has an invalid history.');
  return value;
}

async function readPayload(
  transaction: sql.Transaction,
  table: 'orders' | 'customers' | 'deliveries',
  idColumn: 'order_id' | 'customer_id' | 'delivery_id',
  entityId: string,
) {
  const result = await new sql.Request(transaction)
    .input('tenantId', sql.NVarChar(128), TENANT_ID)
    .input('entityId', sql.NVarChar(128), entityId)
    .query<{ payload_json: string }>(
      `SELECT payload_json FROM dbo.${table} WHERE tenant_id = @tenantId AND ${idColumn} = @entityId`,
    );
  const payload = result.recordset[0]?.payload_json;
  return payload ? object(JSON.parse(payload)) : null;
}

/**
 * Restores only the known judge-demo records changed after the agreed snapshot.
 * This is available solely through an IAM-authorized direct Lambda invocation.
 */
export async function restoreStagingDemoSnapshot(pool: sql.ConnectionPool) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    let restored = 0;

    const ritaOrder = await readPayload(transaction, 'orders', 'order_id', ids.ritaOrder);
    if (ritaOrder?.status === 'ASSIGNED_TO_DELIVERY') {
      const timeline = array(ritaOrder.timeline);
      const last = object(timeline.at(-1));
      if (last.action === 'delivery.assigned' && last.occurredAt === '2026-09-03T11:13:05.326Z') {
        ritaOrder.status = 'READY_FOR_DISPATCH';
        ritaOrder.timeline = timeline.slice(0, -1);
        ritaOrder.updatedAt = '2026-09-02T21:03:34.040Z';
        delete ritaOrder.assignedUserId;
        await new sql.Request(transaction)
          .input('tenantId', sql.NVarChar(128), TENANT_ID)
          .input('orderId', sql.NVarChar(128), ids.ritaOrder)
          .input('updatedAt', sql.DateTime2(3), new Date(String(ritaOrder.updatedAt)))
          .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(ritaOrder))
          .query(`UPDATE dbo.orders SET order_status=N'READY_FOR_DISPATCH', updated_at=@updatedAt,
                  payload_json=@payload WHERE tenant_id=@tenantId AND order_id=@orderId`);
        restored += 1;
      }
    }

    const fadiOrder = await readPayload(transaction, 'orders', 'order_id', ids.fadiOrder);
    if (fadiOrder?.status === 'OUT_FOR_DELIVERY') {
      const timeline = array(fadiOrder.timeline);
      const last = object(timeline.at(-1));
      if (last.action === 'delivery.out_for_delivery' && last.occurredAt === '2026-09-03T11:26:08.912Z') {
        fadiOrder.status = 'ASSIGNED_TO_DELIVERY';
        fadiOrder.timeline = timeline.slice(0, -1);
        fadiOrder.updatedAt = '2026-09-02T21:04:32.699Z';
        await new sql.Request(transaction)
          .input('tenantId', sql.NVarChar(128), TENANT_ID)
          .input('orderId', sql.NVarChar(128), ids.fadiOrder)
          .input('updatedAt', sql.DateTime2(3), new Date(String(fadiOrder.updatedAt)))
          .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(fadiOrder))
          .query(`UPDATE dbo.orders SET order_status=N'ASSIGNED_TO_DELIVERY', updated_at=@updatedAt,
                  payload_json=@payload WHERE tenant_id=@tenantId AND order_id=@orderId`);
        restored += 1;
      }
    }

    const fadiDelivery = await readPayload(transaction, 'deliveries', 'delivery_id', ids.fadiDelivery);
    if (fadiDelivery?.status === 'IN_PROGRESS') {
      const attempts = array(fadiDelivery.attempts);
      const latest = object(attempts.at(-1));
      if (latest.commandId === ids.fadiCommand) {
        fadiDelivery.status = 'ASSIGNED';
        fadiDelivery.updatedAt = '2026-09-02T21:04:32.678Z';
        fadiDelivery.version = 1;
        fadiDelivery.attempts = [
          {
            id: latest.id,
            number: latest.number,
            status: 'SCHEDULED',
            scheduledAt: latest.scheduledAt,
            note: '',
            actorId: '54b88448-0061-7057-89c4-f025787b05e7',
          },
        ];
        await new sql.Request(transaction)
          .input('tenantId', sql.NVarChar(128), TENANT_ID)
          .input('deliveryId', sql.NVarChar(128), ids.fadiDelivery)
          .input('updatedAt', sql.DateTime2(3), new Date(String(fadiDelivery.updatedAt)))
          .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(fadiDelivery))
          .query(`UPDATE dbo.deliveries SET delivery_status=N'ASSIGNED', version_number=1,
                  updated_at=@updatedAt, payload_json=@payload
                  WHERE tenant_id=@tenantId AND delivery_id=@deliveryId`);
        restored += 1;
      }
    }

    const fadiCustomer = await readPayload(transaction, 'customers', 'customer_id', ids.fadiCustomer);
    if (fadiCustomer?.updatedAt === '2026-09-03T11:26:08.912Z') {
      const stats = object(fadiCustomer.orderStats);
      stats.lastOrderAt = '2026-09-02T21:04:32.221Z';
      fadiCustomer.updatedAt = '2026-09-02T21:04:32.221Z';
      await new sql.Request(transaction)
        .input('tenantId', sql.NVarChar(128), TENANT_ID)
        .input('customerId', sql.NVarChar(128), ids.fadiCustomer)
        .input('updatedAt', sql.DateTime2(3), new Date(String(fadiCustomer.updatedAt)))
        .input('payload', sql.NVarChar(sql.MAX), JSON.stringify(fadiCustomer))
        .query(`UPDATE dbo.customers SET updated_at=@updatedAt, payload_json=@payload
                WHERE tenant_id=@tenantId AND customer_id=@customerId`);
    }

    const cleanup = await new sql.Request(transaction)
      .input('tenantId', sql.NVarChar(128), TENANT_ID)
      .input('addedOrder', sql.NVarChar(128), ids.addedOrder)
      .input('addedCustomer', sql.NVarChar(128), ids.addedCustomer)
      .input('ritaDelivery', sql.NVarChar(128), ids.ritaDelivery)
      .input('fadiDelivery', sql.NVarChar(128), ids.fadiDelivery)
      .input('fadiCommand', sql.NVarChar(128), ids.fadiCommand)
      .input('cutoff', sql.DateTime2(3), new Date(BASELINE_CUTOFF))
      .query(`
        DELETE FROM dbo.driver_commands WHERE tenant_id=@tenantId AND command_id=@fadiCommand;
        DELETE FROM dbo.inventory_movements
          WHERE tenant_id=@tenantId AND idempotency_key LIKE N'order:' + @addedOrder + N':%';
        DELETE FROM dbo.deliveries WHERE tenant_id=@tenantId AND delivery_id=@ritaDelivery;
        DELETE FROM dbo.audit_events WHERE tenant_id=@tenantId AND occurred_at>@cutoff
          AND entity_id IN (@addedOrder,@addedCustomer,@ritaDelivery,@fadiDelivery);
        DELETE FROM dbo.orders WHERE tenant_id=@tenantId AND order_id=@addedOrder;
        DELETE FROM dbo.customers WHERE tenant_id=@tenantId AND customer_id=@addedCustomer;
      `);

    await transaction.commit();
    return { ok: true, restoredAggregates: restored, cleanupStatements: cleanup.rowsAffected };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
