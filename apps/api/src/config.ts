import { z } from 'zod';

const configSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3001),
    HOST: z.string().default('127.0.0.1'),
    MAASAR_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    AUTH_MODE: z.enum(['dev', 'cognito']).default('dev'),
    LOG_LEVEL: z.string().default('info'),
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
    AWS_REGION: z.string().optional(),
    SQLSERVER_CONNECTION_STRING: z.string().min(1).optional(),
  })
  .superRefine((value, context) => {
    const deployed = value.MAASAR_ENV === 'staging' || value.MAASAR_ENV === 'production';
    if (deployed && value.AUTH_MODE !== 'cognito') {
      context.addIssue({
        code: 'custom',
        path: ['AUTH_MODE'],
        message: 'AUTH_MODE must be cognito in staging and production; demo credentials are local-only',
      });
    }
    if (value.AUTH_MODE === 'dev') {
      const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);
      if (!loopbackHosts.has(value.HOST)) {
        context.addIssue({
          code: 'custom',
          path: ['HOST'],
          message: 'Development authentication may bind only to a loopback host',
        });
      }
      try {
        if (!loopbackHosts.has(new URL(value.WEB_ORIGIN).hostname)) {
          context.addIssue({
            code: 'custom',
            path: ['WEB_ORIGIN'],
            message: 'Development authentication accepts only a loopback web origin',
          });
        }
      } catch {
        context.addIssue({ code: 'custom', path: ['WEB_ORIGIN'], message: 'WEB_ORIGIN must be a URL' });
      }
    }
    if (value.AUTH_MODE === 'cognito') {
      for (const key of ['COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID', 'AWS_REGION'] as const) {
        if (!value[key]) {
          context.addIssue({ code: 'custom', path: [key], message: `${key} is required` });
        }
      }
    }
    if (
      deployed && !value.SQLSERVER_CONNECTION_STRING
    ) {
      context.addIssue({
        code: 'custom',
        path: ['SQLSERVER_CONNECTION_STRING'],
        message: 'SQLSERVER_CONNECTION_STRING is required outside local/test environments',
      });
    }
  });

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(environment);
}
