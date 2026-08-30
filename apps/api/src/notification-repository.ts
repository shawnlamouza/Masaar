export interface NotificationStateRepository {
  listReadIds(tenantId: string, userId: string): Promise<string[]>;
  markRead(tenantId: string, userId: string, notificationId: string): Promise<void>;
}

export class InMemoryNotificationStateRepository implements NotificationStateRepository {
  private readonly reads = new Map<string, Set<string>>();
  async listReadIds(tenantId: string, userId: string) {
    return [...(this.reads.get(`${tenantId}:${userId}`) ?? new Set<string>())];
  }
  async markRead(tenantId: string, userId: string, notificationId: string) {
    const key = `${tenantId}:${userId}`;
    const ids = this.reads.get(key) ?? new Set<string>();
    ids.add(notificationId);
    this.reads.set(key, ids);
  }
}
