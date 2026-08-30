import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  ListUsersCommand,
  type AttributeType,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  ROLE_PERMISSIONS,
  businessSettingsSchema,
  registerBusinessSchema,
  roleSchema,
  sessionSchema,
  signInRequestSchema,
  type Permission,
  type Role,
  type Session,
  teamMemberSchema,
  type TeamMember,
} from '@masaar/contracts';
import type { AppConfig } from './config.js';
import type { BusinessSettingsRepository } from './settings.js';

type DevIdentity = {
  userId: string;
  displayName: string;
  role: Role;
  email: string;
  password: string;
  tenantId?: string;
  onboardingRequired?: boolean;
  createdAt?: string;
};

const DEV_IDENTITIES: Record<string, DevIdentity> = {
  'dev.owner': {
    userId: 'usr_owner',
    displayName: 'Joe Haddad',
    role: 'OWNER',
    email: 'joe@masaar.demo',
    password: 'masaar-demo',
  },
  'dev.manager': {
    userId: 'usr_manager',
    displayName: 'Nadim Manager',
    role: 'MANAGER',
    email: 'manager@masaar.demo',
    password: 'masaar-demo',
  },
  'dev.employee': {
    userId: 'usr_employee',
    displayName: 'Rami Employee',
    role: 'EMPLOYEE',
    email: 'employee@masaar.demo',
    password: 'masaar-demo',
  },
  'dev.driver': {
    userId: 'usr_driver',
    displayName: 'Karim Driver',
    role: 'DRIVER',
    email: 'driver@masaar.demo',
    password: 'masaar-demo',
  },
  'dev.readonly': {
    userId: 'usr_readonly',
    displayName: 'Lea Analyst',
    role: 'READ_ONLY',
    email: 'analyst@masaar.demo',
    password: 'masaar-demo',
  },
};

const DYNAMIC_IDENTITIES = new Map<string, { token: string; identity: DevIdentity }>();

function findCredential(email: string) {
  const normalized = email.trim().toLowerCase();
  const builtIn = Object.entries(DEV_IDENTITIES).find(
    ([, identity]) => identity.email === normalized,
  );
  return builtIn ? { token: builtIn[0], identity: builtIn[1] } : DYNAMIC_IDENTITIES.get(normalized);
}

export function provisionDevMember(input: {
  tenantId: string;
  displayName: string;
  email: string;
  role: Role;
  password: string;
  onboardingRequired?: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  if (findCredential(email))
    throw Object.assign(new Error('A user with this email already exists.'), { statusCode: 409 });
  const identity: DevIdentity = {
    userId: `usr_${randomUUID()}`,
    displayName: input.displayName,
    role: input.role,
    email,
    password: input.password,
    tenantId: input.tenantId,
    onboardingRequired: input.onboardingRequired ?? false,
    createdAt: new Date().toISOString(),
  };
  const token = `dev.member.${randomUUID()}`;
  DYNAMIC_IDENTITIES.set(email, { token, identity });
  return { token, identity };
}

export function listDevTeam(tenantId: string): TeamMember[] {
  const createdAt = '2026-08-22T08:00:00.000Z';
  const demo =
    tenantId === 'tenant_cedar_thread'
      ? Object.values(DEV_IDENTITIES).map((identity) => ({ ...identity, tenantId, createdAt }))
      : [];
  const dynamic = [...DYNAMIC_IDENTITIES.values()]
    .map(({ identity }) => identity)
    .filter((identity) => identity.tenantId === tenantId);
  return [...demo, ...dynamic].map((identity) =>
    teamMemberSchema.parse({
      id: identity.userId,
      tenantId,
      displayName: identity.displayName,
      email: identity.email,
      role: identity.role,
      status: 'ACTIVE',
      createdAt: identity.createdAt ?? createdAt,
    }),
  );
}

function attribute(attributes: AttributeType[] | undefined, name: string) {
  return attributes?.find((item) => item.Name === name)?.Value;
}

function cognitoClient(config: AppConfig) {
  return new CognitoIdentityProviderClient({ region: config.AWS_REGION! });
}

export async function provisionMember(
  config: AppConfig,
  input: {
    tenantId: string;
    displayName: string;
    email: string;
    role: Role;
    password: string;
    phone?: string;
    onboardingRequired?: boolean;
  },
) {
  if (config.AUTH_MODE === 'dev') return provisionDevMember(input);
  const client = cognitoClient(config);
  const email = input.email.trim().toLowerCase();
  let created;
  try {
    created = await client.send(
      new AdminCreateUserCommand({
        UserPoolId: config.COGNITO_USER_POOL_ID!,
        Username: email,
        TemporaryPassword: input.password,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: input.displayName },
          { Name: 'custom:tenantId', Value: input.tenantId },
          { Name: 'custom:role', Value: input.role },
          ...(input.phone ? [{ Name: 'phone_number', Value: input.phone }] : []),
        ],
      }),
    );
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: config.COGNITO_USER_POOL_ID!,
        Username: email,
        Password: input.password,
        Permanent: true,
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'UsernameExistsException')
      throw Object.assign(new Error('A user with this email already exists.'), {
        statusCode: 409,
      });
    throw error;
  }
  const identity: DevIdentity = {
    userId: attribute(created.User?.Attributes, 'sub') ?? created.User?.Username ?? email,
    displayName: input.displayName,
    role: input.role,
    email,
    password: '',
    tenantId: input.tenantId,
    onboardingRequired: input.onboardingRequired ?? false,
    createdAt: created.User?.UserCreateDate?.toISOString() ?? new Date().toISOString(),
  };
  return { token: '', identity };
}

export async function listTeam(config: AppConfig, tenantId: string): Promise<TeamMember[]> {
  if (config.AUTH_MODE === 'dev') return listDevTeam(tenantId);
  const client = cognitoClient(config);
  const users: UserType[] = [];
  let paginationToken: string | undefined;
  do {
    const page = await client.send(
      new ListUsersCommand({
        UserPoolId: config.COGNITO_USER_POOL_ID!,
        ...(paginationToken ? { PaginationToken: paginationToken } : {}),
      }),
    );
    users.push(...(page.Users ?? []));
    paginationToken = page.PaginationToken;
  } while (paginationToken);
  return users.flatMap((user) => {
    const ownedTenant = attribute(user.Attributes, 'custom:tenantId');
    const role = roleSchema.safeParse(attribute(user.Attributes, 'custom:role'));
    const email = attribute(user.Attributes, 'email');
    if (ownedTenant !== tenantId || !role.success || !email) return [];
    return [
      teamMemberSchema.parse({
        id: attribute(user.Attributes, 'sub') ?? user.Username ?? email,
        tenantId,
        displayName: attribute(user.Attributes, 'name') ?? email.split('@')[0] ?? 'Masaar user',
        email,
        role: role.data,
        status: user.Enabled === false ? 'DISABLED' : 'ACTIVE',
        createdAt: user.UserCreateDate?.toISOString() ?? new Date().toISOString(),
      }),
    ];
  });
}

function bearerToken(request: FastifyRequest): string | null {
  const value = request.headers.authorization;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length).trim();
}

function devSession(request: FastifyRequest): Session | null {
  const token = bearerToken(request);
  if (!token) return null;
  const identity =
    DEV_IDENTITIES[token] ??
    [...DYNAMIC_IDENTITIES.values()].find((item) => item.token === token)?.identity;
  const tenantId = request.headers['x-tenant-id'];
  if (!identity || (!identity.tenantId && (typeof tenantId !== 'string' || !tenantId))) return null;
  return sessionSchema.parse({
    ...identity,
    tenantId: identity.tenantId ?? tenantId,
    permissions: ROLE_PERMISSIONS[identity.role],
    authMode: 'dev',
    onboardingRequired: identity.onboardingRequired ?? false,
  });
}

export async function registerAuth(
  app: FastifyInstance,
  config: AppConfig,
  settings: BusinessSettingsRepository,
) {
  const verifier =
    config.AUTH_MODE === 'cognito'
      ? CognitoJwtVerifier.create({
          userPoolId: config.COGNITO_USER_POOL_ID!,
          tokenUse: 'id',
          clientId: config.COGNITO_CLIENT_ID!,
        })
      : null;

  app.decorateRequest('session', null);
  app.decorateRequest('correlationId', '');

  app.addHook('onRequest', async (request, reply) => {
    request.correlationId =
      (typeof request.headers['x-correlation-id'] === 'string' &&
        request.headers['x-correlation-id']) ||
      randomUUID();
    reply.header('x-correlation-id', request.correlationId);

    if (request.url === '/health') return;
    if (config.AUTH_MODE === 'dev') {
      request.session = devSession(request);
      return;
    }

    const token = bearerToken(request);
    if (!token || !verifier) return;
    let payload;
    try {
      payload = await verifier.verify(token);
    } catch {
      return;
    }
    const tenantId = payload['custom:tenantId'];
    const roleValue = payload['custom:role'];
    const role = roleSchema.safeParse(roleValue);
    if (typeof tenantId !== 'string' || !role.success) return;
    request.session = sessionSchema.parse({
      userId: payload.sub,
      tenantId,
      displayName:
        typeof payload.name === 'string'
          ? payload.name
          : typeof payload['cognito:username'] === 'string'
            ? payload['cognito:username']
            : 'Masaar user',
      role: role.data,
      permissions: ROLE_PERMISSIONS[role.data],
      authMode: 'cognito',
    });
  });

  app.post('/api/auth/sign-in', async (request, reply) => {
    const credentials = signInRequestSchema.parse(request.body);
    if (config.AUTH_MODE === 'cognito') {
      if (!verifier) throw new Error('Cognito authentication is not configured.');
      let accessToken: string;
      try {
        ({ accessToken } = await clientSignIn(
          config,
          credentials.email,
          credentials.password,
          verifier,
        ));
      } catch {
        return reply.code(401).send({
          error: 'INVALID_CREDENTIALS',
          message: 'Email or password is incorrect.',
          correlationId: request.correlationId,
        });
      }
      const payload = await verifier.verify(accessToken);
      const tenantId = payload['custom:tenantId'];
      const role = roleSchema.safeParse(payload['custom:role']);
      if (typeof tenantId !== 'string' || !role.success)
        return reply.code(403).send({
          error: 'ACCOUNT_NOT_CONFIGURED',
          message: 'This Cognito account is missing its Masaar business or role.',
          correlationId: request.correlationId,
        });
      return {
        accessToken,
        session: sessionSchema.parse({
          userId: payload.sub,
          tenantId,
          displayName:
            typeof payload.name === 'string'
              ? payload.name
              : typeof payload['cognito:username'] === 'string'
                ? payload['cognito:username']
                : credentials.email,
          role: role.data,
          permissions: ROLE_PERMISSIONS[role.data],
          authMode: 'cognito',
          onboardingRequired: false,
        }),
      };
    }
    const match = findCredential(credentials.email);
    if (!match || credentials.password !== match.identity.password) {
      return reply.code(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
        correlationId: request.correlationId,
      });
    }
    const { token: accessToken, identity } = match;
    return {
      accessToken,
      session: sessionSchema.parse({
        ...identity,
        tenantId: identity.tenantId ?? 'tenant_cedar_thread',
        permissions: ROLE_PERMISSIONS[identity.role],
        authMode: 'dev',
        onboardingRequired: identity.onboardingRequired ?? false,
      }),
    };
  });

  app.post('/api/auth/register-business', async (request, reply) => {
    const input = registerBusinessSchema.parse(request.body);
    const tenantId = `org_${randomUUID()}`;
    const { token, identity } = await provisionMember(config, {
      tenantId,
      displayName: input.ownerName,
      email: input.email,
      role: 'OWNER',
      password: input.password,
      onboardingRequired: true,
    });
    await settings.put(
      businessSettingsSchema.parse({
        tenantId,
        businessName: input.businessName,
        baseCurrency: 'USD',
        enabledCurrencies: ['USD', 'LBP'],
        timezone: 'Asia/Beirut',
        lowConnectivityMode: true,
        updatedAt: new Date().toISOString(),
        updatedBy: identity.userId,
      }),
    );
    const accessToken =
      config.AUTH_MODE === 'dev'
        ? token
        : (await clientSignIn(config, input.email, input.password, verifier)).accessToken;
    return reply.code(201).send({
      accessToken,
      session: sessionSchema.parse({
        userId: identity.userId,
        tenantId,
        displayName: identity.displayName,
        role: 'OWNER',
        permissions: ROLE_PERMISSIONS.OWNER,
        authMode: config.AUTH_MODE,
        onboardingRequired: true,
      }),
    });
  });
}

async function clientSignIn(
  config: AppConfig,
  email: string,
  password: string,
  verifier: ReturnType<typeof CognitoJwtVerifier.create> | null,
) {
  const result = await cognitoClient(config).send(
    new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: config.COGNITO_CLIENT_ID!,
      AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
    }),
  );
  const accessToken = result.AuthenticationResult?.IdToken;
  if (!accessToken || !verifier) throw new Error('Cognito did not return an ID token.');
  await verifier.verify(accessToken);
  return { accessToken };
}

export async function requireSession(request: FastifyRequest, reply: FastifyReply) {
  if (!request.session) {
    return reply.code(401).send({
      error: 'UNAUTHENTICATED',
      message: 'A valid Masaar session is required.',
      correlationId: request.correlationId,
    });
  }
}

export function requirePermission(permission: Permission) {
  return async function permissionGuard(request: FastifyRequest, reply: FastifyReply) {
    if (!request.session) return requireSession(request, reply);
    if (!request.session.permissions.includes(permission)) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: `Missing permission: ${permission}`,
        correlationId: request.correlationId,
      });
    }
  };
}
