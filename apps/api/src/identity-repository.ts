import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Role } from '@masaar/contracts';

export type StoredIdentity = {
  userId: string;
  tenantId: string;
  displayName: string;
  role: Role;
  email: string;
  passwordHash: string;
  accessToken: string;
  onboardingRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PasswordResetRecord = {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
};

export interface IdentityRepository {
  findByEmail(email: string): Promise<StoredIdentity | null>;
  findByToken(accessToken: string): Promise<StoredIdentity | null>;
  listForTenant(tenantId: string): Promise<StoredIdentity[]>;
  create(identity: StoredIdentity): Promise<void>;
  save(identity: StoredIdentity): Promise<void>;
  getPasswordReset(email: string): Promise<PasswordResetRecord | null>;
  savePasswordReset(reset: PasswordResetRecord): Promise<void>;
  deletePasswordReset(email: string): Promise<void>;
}

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly identities = new Map<string, StoredIdentity>();

  async findByEmail(email: string) {
    return this.identities.get(email.trim().toLowerCase()) ?? null;
  }

  async findByToken(accessToken: string) {
    return (
      [...this.identities.values()].find((identity) => identity.accessToken === accessToken) ?? null
    );
  }

  async listForTenant(tenantId: string) {
    return [...this.identities.values()].filter((identity) => identity.tenantId === tenantId);
  }

  async create(identity: StoredIdentity) {
    const email = identity.email.trim().toLowerCase();
    if (this.identities.has(email)) {
      throw Object.assign(new Error('A user with this email already exists.'), { statusCode: 409 });
    }
    this.identities.set(email, { ...identity, email });
  }

  async save(identity: StoredIdentity) {
    this.identities.set(identity.email.trim().toLowerCase(), {
      ...identity,
      email: identity.email.trim().toLowerCase(),
    });
  }

  private readonly passwordResets = new Map<string, PasswordResetRecord>();

  async getPasswordReset(email: string) {
    return this.passwordResets.get(email.trim().toLowerCase()) ?? null;
  }

  async savePasswordReset(reset: PasswordResetRecord) {
    this.passwordResets.set(reset.email.trim().toLowerCase(), {
      ...reset,
      email: reset.email.trim().toLowerCase(),
    });
  }

  async deletePasswordReset(email: string) {
    this.passwordResets.delete(email.trim().toLowerCase());
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const digest = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
