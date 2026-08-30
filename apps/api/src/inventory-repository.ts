import {
  inventoryMovementSchema,
  returnCaseSchema,
  type InventoryMovement,
  type ReturnCase,
} from '@masaar/contracts';

export interface InventoryRepository {
  listMovements(tenantId: string): Promise<InventoryMovement[]>;
  findMovementByKey(tenantId: string, idempotencyKey: string): Promise<InventoryMovement | null>;
  saveMovement(movement: InventoryMovement): Promise<void>;
  listReturns(tenantId: string): Promise<ReturnCase[]>;
  getReturn(tenantId: string, id: string): Promise<ReturnCase | null>;
  saveReturn(returnCase: ReturnCase): Promise<void>;
}

type TenantInventory = { movements: InventoryMovement[]; returns: ReturnCase[] };

export class InMemoryInventoryRepository implements InventoryRepository {
  private readonly tenants = new Map<string, TenantInventory>();

  private data(tenantId: string) {
    const current = this.tenants.get(tenantId);
    if (current) return current;
    const created = { movements: [], returns: [] };
    this.tenants.set(tenantId, created);
    return created;
  }

  async listMovements(tenantId: string) {
    return structuredClone(this.data(tenantId).movements).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async findMovementByKey(tenantId: string, idempotencyKey: string) {
    return structuredClone(
      this.data(tenantId).movements.find((item) => item.idempotencyKey === idempotencyKey) ?? null,
    );
  }

  async saveMovement(movement: InventoryMovement) {
    const parsed = inventoryMovementSchema.parse(structuredClone(movement));
    const items = this.data(parsed.tenantId).movements;
    const existing = items.find((item) => item.idempotencyKey === parsed.idempotencyKey);
    if (existing) return;
    items.push(parsed);
  }

  async listReturns(tenantId: string) {
    return structuredClone(this.data(tenantId).returns).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async getReturn(tenantId: string, id: string) {
    return structuredClone(this.data(tenantId).returns.find((item) => item.id === id) ?? null);
  }

  async saveReturn(returnCase: ReturnCase) {
    const parsed = returnCaseSchema.parse(structuredClone(returnCase));
    const items = this.data(parsed.tenantId).returns;
    const index = items.findIndex((item) => item.id === parsed.id);
    if (index === -1) items.push(parsed);
    else items[index] = parsed;
  }
}
