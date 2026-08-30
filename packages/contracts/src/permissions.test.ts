import { describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from './index.js';

describe('role permissions', () => {
  it('keeps driver access restricted to delivery', () => {
    expect(ROLE_PERMISSIONS.DRIVER).toEqual(['delivery:read', 'delivery:write']);
  });

  it('reserves reconciliation approval for managers and owners', () => {
    expect(ROLE_PERMISSIONS.EMPLOYEE).not.toContain('reconciliation:approve');
    expect(ROLE_PERMISSIONS.MANAGER).toContain('reconciliation:approve');
    expect(ROLE_PERMISSIONS.OWNER).toContain('reconciliation:approve');
  });
});
