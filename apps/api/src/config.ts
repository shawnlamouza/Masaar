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
    if (value.AUTH_MODE === 'cognito') {
      for (const key of ['COGNITO_USER_POOL_ID', 'COGNITO_CLIENT_ID', 'AWS_REGION'] as const) {
        if (!value[key]) {
          context.addIssue({ code: 'custom', path: [key], message: `${key} is required` });
        }
      }
    }
    if (
      (value.MAASAR_ENV === 'staging' || value.MAASAR_ENV === 'production') &&
      !value.SQLSERVER_CONNECTION_STRING
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
