import { businessSettingsSchema, type BusinessSettings } from '@masaar/contracts';

export interface BusinessSettingsRepository {
  get(tenantId: string): Promise<BusinessSettings | null>;
  put(settings: BusinessSettings): Promise<void>;
}

export class InMemoryBusinessSettingsRepository implements BusinessSettingsRepository {
  private readonly settings = new Map<string, BusinessSettings>();

  async get(tenantId: string) {
    return this.settings.get(tenantId) ?? null;
  }

  async put(settings: BusinessSettings) {
    const parsed = businessSettingsSchema.parse(settings);
    this.settings.set(parsed.tenantId, parsed);
  }
}

export function defaultBusinessSettings(tenantId: string, userId: string): BusinessSettings {
  return businessSettingsSchema.parse({
    tenantId,
    businessName: 'Cedar & Thread',
    baseCurrency: 'USD',
    enabledCurrencies: ['USD', 'LBP'],
    timezone: 'Asia/Beirut',
    lowConnectivityMode: true,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  });
}
