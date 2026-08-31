import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('production authentication boundary', () => {
  it('rejects dev authentication in staging or production', () => {
    expect(() =>
      loadConfig({
        MAASAR_ENV: 'production',
        AUTH_MODE: 'dev',
        HOST: '127.0.0.1',
        WEB_ORIGIN: 'http://localhost:5173',
        SQLSERVER_CONNECTION_STRING: 'Server=example',
      }),
    ).toThrow(/AUTH_MODE must be cognito/);
  });

  it('rejects dev authentication on a public bind or origin', () => {
    expect(() =>
      loadConfig({
        MAASAR_ENV: 'development',
        AUTH_MODE: 'dev',
        HOST: '0.0.0.0',
        WEB_ORIGIN: 'https://demo.example.com',
      }),
    ).toThrow(/loopback/);
  });

  it('accepts a fully configured Cognito production environment', () => {
    expect(
      loadConfig({
        MAASAR_ENV: 'production',
        AUTH_MODE: 'cognito',
        HOST: '0.0.0.0',
        WEB_ORIGIN: 'https://masaar.example.com',
        COGNITO_USER_POOL_ID: 'pool',
        COGNITO_CLIENT_ID: 'client',
        AWS_REGION: 'eu-central-1',
        SQLSERVER_CONNECTION_STRING: 'Server=example',
      }).AUTH_MODE,
    ).toBe('cognito');
  });
});
