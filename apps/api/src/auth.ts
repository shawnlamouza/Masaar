import { randomInt, randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  AdminCreateUserCommand,
  AdminResetUserPasswordCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
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
import type { FulfillmentRepository } from './fulfillment-repository.js';
import { sendPasswordResetEmail } from './email-service.js';
import { hashPassword, verifyPassword, type IdentityRepository } from './identity-repository.js';

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
    password: 'Masaar-Demo1!',
  },
  'dev.manager': {
    userId: 'usr_manager',
    displayName: 'Nadim Manager',
    role: 'MANAGER',
    email: 'manager@masaar.demo',
    password: 'Masaar-Demo1!',
  },
  'dev.employee': {
    userId: 'usr_employee',
    displayName: 'Rami Employee',
    role: 'EMPLOYEE',
    email: 'employee@masaar.demo',
    password: 'Masaar-Demo1!',
  },
  'dev.driver': {
    userId: 'usr_driver',
    displayName: 'Karim Driver',
    role: 'DRIVER',
    email: 'driver@masaar.demo',
    password: 'Masaar-Demo1!',
  },
};

const DEMO_IDENTITIES: Record<string, DevIdentity> = {
  'dev.owner': {
    ...DEV_IDENTITIES['dev.owner']!,
    userId: '54b88448-0061-7057-89c4-f025787b05e7',
    displayName: 'Joe',
  },
  'dev.manager': {
    ...DEV_IDENTITIES['dev.manager']!,
    userId: '34186458-f031-704c-5a06-69cb7f1a5d52',
    displayName: 'Nadim',
  },
  'dev.employee': {
    ...DEV_IDENTITIES['dev.employee']!,
    userId: '84386488-5061-703e-604f-7a324126878a',
    displayName: 'Rami',
  },
  'dev.driver': {
    ...DEV_IDENTITIES['dev.driver']!,
    userId: '74681468-2031-7042-32b5-4b618a5238c4',
    displayName: 'Karim',
  },
};

async function findCredential(
  email: string,
  authMode: 'dev' | 'demo',
  identities: IdentityRepository,
) {
  const normalized = email.trim().toLowerCase();
  const builtIn = Object.entries(authMode === 'demo' ? DEMO_IDENTITIES : DEV_IDENTITIES).find(
    ([, identity]) => identity.email === normalized,
  );
  if (builtIn) return { token: builtIn[0], identity: builtIn[1], passwordHash: null };
  const stored = await identities.findByEmail(normalized);
  if (!stored) return null;
  return {
    token: stored.accessToken,
    identity: {
      userId: stored.userId,
      displayName: stored.displayName,
      role: stored.role,
      email: stored.email,
      password: '',
      tenantId: stored.tenantId,
      onboardingRequired: stored.onboardingRequired,
      createdAt: stored.createdAt,
    },
    passwordHash: stored.passwordHash,
  };
}

export async function provisionDevMember(
  identities: IdentityRepository,
  input: {
    tenantId: string;
    displayName: string;
    email: string;
    role: Role;
    password: string;
    onboardingRequired?: boolean;
  },
  authMode: 'dev' | 'demo' = 'dev',
) {
  const email = input.email.trim().toLowerCase();
  if (await findCredential(email, authMode, identities))
    throw Object.assign(new Error('A user with this email already exists.'), { statusCode: 409 });
  const timestamp = new Date().toISOString();
  const identity: DevIdentity = {
    userId: `usr_${randomUUID()}`,
    displayName: input.displayName,
    role: input.role,
    email,
    password: input.password,
    tenantId: input.tenantId,
    onboardingRequired: input.onboardingRequired ?? false,
    createdAt: timestamp,
  };
  const token = `dev.member.${randomUUID()}`;
  await identities.create({
    userId: identity.userId,
    tenantId: identity.tenantId!,
    displayName: identity.displayName,
    role: identity.role,
    email,
    passwordHash: hashPassword(input.password),
    accessToken: token,
    onboardingRequired: identity.onboardingRequired ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { token, identity };
}

export async function listDevTeam(
  identities: IdentityRepository,
  tenantId: string,
  authMode: 'dev' | 'demo' = 'dev',
): Promise<TeamMember[]> {
  const createdAt = '2026-08-22T08:00:00.000Z';
  const demo =
    tenantId === 'tenant_cedar_thread'
      ? Object.values(authMode === 'demo' ? DEMO_IDENTITIES : DEV_IDENTITIES).map((identity) => ({
          ...identity,
          tenantId,
          createdAt,
        }))
      : [];
  const dynamic = (await identities.listForTenant(tenantId)).map((identity) => ({
    userId: identity.userId,
    displayName: identity.displayName,
    role: identity.role,
    email: identity.email,
    password: '',
    tenantId: identity.tenantId,
    onboardingRequired: identity.onboardingRequired,
    createdAt: identity.createdAt,
  }));
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
  identities: IdentityRepository,
  input: {
    tenantId: string;
    displayName: string;
    email: string;
    role: Role;
    password: string;
    phone?: string;
    onboardingRequired?: boolean;
    requireEmailProof?: boolean;
  },
) {
  if (config.AUTH_MODE !== 'cognito')
    return provisionDevMember(identities, input, config.AUTH_MODE);
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
    if (input.requireEmailProof)
      await client.send(
        new AdminResetUserPasswordCommand({
          UserPoolId: config.COGNITO_USER_POOL_ID!,
          Username: email,
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

export async function listTeam(
  config: AppConfig,
  identities: IdentityRepository,
  tenantId: string,
): Promise<TeamMember[]> {
  if (config.AUTH_MODE !== 'cognito') return listDevTeam(identities, tenantId, config.AUTH_MODE);
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
        status:
          user.Enabled === false
            ? 'DISABLED'
            : ['FORCE_CHANGE_PASSWORD', 'RESET_REQUIRED', 'UNCONFIRMED'].includes(
                  user.UserStatus ?? '',
                )
              ? 'INVITED'
              : 'ACTIVE',
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

async function devSession(
  request: FastifyRequest,
  authMode: 'dev' | 'demo',
  identities: IdentityRepository,
): Promise<Session | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const builtIn = (authMode === 'demo' ? DEMO_IDENTITIES : DEV_IDENTITIES)[token];
  const stored = builtIn ? null : await identities.findByToken(token);
  const identity =
    builtIn ??
    (stored
      ? {
          userId: stored.userId,
          displayName: stored.displayName,
          role: stored.role,
          email: stored.email,
          password: '',
          tenantId: stored.tenantId,
          onboardingRequired: stored.onboardingRequired,
          createdAt: stored.createdAt,
        }
      : null);
  const tenantId = request.headers['x-tenant-id'];
  if (!identity || (!identity.tenantId && (typeof tenantId !== 'string' || !tenantId))) return null;
  return sessionSchema.parse({
    ...identity,
    tenantId: identity.tenantId ?? tenantId,
    permissions: ROLE_PERMISSIONS[identity.role],
    authMode,
    onboardingRequired: identity.onboardingRequired ?? false,
  });
}

export async function registerAuth(
  app: FastifyInstance,
  config: AppConfig,
  settings: BusinessSettingsRepository,
  fulfillment: FulfillmentRepository,
  identities: IdentityRepository,
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
    if (config.AUTH_MODE !== 'cognito') {
      request.session = await devSession(request, config.AUTH_MODE, identities);
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
      } catch (error) {
        if (error instanceof Error && error.name === 'PasswordResetRequiredException')
          return reply.code(409).send({
            error: 'PASSWORD_RESET_REQUIRED',
            message: 'Verify your email and choose a password to activate this account.',
            correlationId: request.correlationId,
          });
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
      const session = sessionSchema.parse({
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
      });
      await ensureDriverResource(fulfillment, session);
      return {
        accessToken,
        session,
      };
    }
    const match = await findCredential(credentials.email, config.AUTH_MODE, identities);
    const passwordMatches =
      match &&
      (match.passwordHash
        ? verifyPassword(credentials.password, match.passwordHash)
        : credentials.password === match.identity.password);
    if (!match || !passwordMatches) {
      return reply.code(401).send({
        error: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
        correlationId: request.correlationId,
      });
    }
    const { token: accessToken, identity } = match;
    const session = sessionSchema.parse({
      ...identity,
      tenantId: identity.tenantId ?? 'tenant_cedar_thread',
      permissions: ROLE_PERMISSIONS[identity.role],
      authMode: config.AUTH_MODE,
      onboardingRequired: identity.onboardingRequired ?? false,
    });
    await ensureDriverResource(fulfillment, session);
    return {
      accessToken,
      session,
    };
  });

  app.post('/api/auth/forgot-password', async (request) => {
    const email = String((request.body as { email?: unknown })?.email ?? '')
      .trim()
      .toLowerCase();
    if (!email.includes('@')) return { accepted: true };
    if (config.AUTH_MODE === 'cognito') {
      try {
        await cognitoClient(config).send(
          new ForgotPasswordCommand({ ClientId: config.COGNITO_CLIENT_ID!, Username: email }),
        );
      } catch {
        // Deliberately return the same response so this endpoint cannot reveal registered emails.
      }
    } else {
      const identity = await identities.findByEmail(email);
      if (identity) {
        const code = String(randomInt(100000, 1_000_000));
        const timestamp = new Date();
        await identities.savePasswordReset({
          email,
          codeHash: hashPassword(code),
          expiresAt: new Date(timestamp.getTime() + 15 * 60 * 1000).toISOString(),
          attempts: 0,
          createdAt: timestamp.toISOString(),
        });
        try {
          await sendPasswordResetEmail(config, email, code);
        } catch (error) {
          request.log.error({ error }, 'Could not send Azure password reset email');
        }
      }
    }
    return { accepted: true };
  });

  app.post('/api/auth/confirm-password-reset', async (request, reply) => {
    const body = request.body as { email?: string; code?: string; newPassword?: string };
    if (!body.email || !body.code || !body.newPassword || body.newPassword.length < 8)
      return reply.badRequest(
        'Email, verification code and a password of at least 8 characters are required.',
      );
    if (config.AUTH_MODE !== 'cognito') {
      const email = body.email.trim().toLowerCase();
      const reset = await identities.getPasswordReset(email);
      const identity = await identities.findByEmail(email);
      const valid =
        reset &&
        identity &&
        reset.attempts < 5 &&
        Date.parse(reset.expiresAt) > Date.now() &&
        verifyPassword(body.code.trim(), reset.codeHash);
      if (!valid) {
        if (reset) {
          if (reset.attempts >= 4) await identities.deletePasswordReset(email);
          else await identities.savePasswordReset({ ...reset, attempts: reset.attempts + 1 });
        }
        return reply.badRequest(
          'The verification code is invalid or expired. Request a new code and try again.',
        );
      }
      await identities.save({
        ...identity,
        passwordHash: hashPassword(body.newPassword),
        accessToken: `dev.member.${randomUUID()}`,
        updatedAt: new Date().toISOString(),
      });
      await identities.deletePasswordReset(email);
      return { reset: true };
    }
    try {
      await cognitoClient(config).send(
        new ConfirmForgotPasswordCommand({
          ClientId: config.COGNITO_CLIENT_ID!,
          Username: body.email.trim().toLowerCase(),
          ConfirmationCode: body.code.trim(),
          Password: body.newPassword,
        }),
      );
    } catch {
      return reply.badRequest(
        'The verification code is invalid or expired. Request a new code and try again.',
      );
    }
    return { reset: true };
  });

  app.post('/api/auth/register-business', async (request, reply) => {
    const input = registerBusinessSchema.parse(request.body);
    const tenantId = `org_${randomUUID()}`;
    const { token, identity } = await provisionMember(config, identities, {
      tenantId,
      displayName: input.ownerName,
      email: input.email,
      role: 'OWNER',
      password: input.password,
      onboardingRequired: true,
      requireEmailProof: config.AUTH_MODE === 'cognito',
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
    if (config.AUTH_MODE === 'cognito')
      return reply.code(202).send({
        verificationRequired: true,
        email: input.email.trim().toLowerCase(),
        message:
          'A verification code was sent by Amazon Cognito. Set your password to activate the workspace.',
      });
    const accessToken = token;
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

export async function resetMemberPassword(
  config: AppConfig,
  identities: IdentityRepository,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  if (config.AUTH_MODE !== 'cognito') {
    const match = await findCredential(normalized, config.AUTH_MODE, identities);
    if (!match) throw Object.assign(new Error('Team member not found.'), { statusCode: 404 });
    const temporaryPassword = `Masaar-${randomUUID().slice(0, 8)}`;
    if (match.passwordHash) {
      const stored = await identities.findByEmail(normalized);
      if (!stored) throw Object.assign(new Error('Team member not found.'), { statusCode: 404 });
      await identities.save({
        ...stored,
        passwordHash: hashPassword(temporaryPassword),
        updatedAt: new Date().toISOString(),
      });
    } else {
      match.identity.password = temporaryPassword;
    }
    return { sent: false, temporaryPassword };
  }
  await cognitoClient(config).send(
    new AdminResetUserPasswordCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID!,
      Username: normalized,
    }),
  );
  return { sent: true };
}

export async function updateMember(
  config: AppConfig,
  identities: IdentityRepository,
  email: string,
  input: { displayName: string; role: Exclude<Role, 'OWNER'>; phone?: string },
) {
  const normalized = email.trim().toLowerCase();
  if (config.AUTH_MODE !== 'cognito') {
    const match = await findCredential(normalized, config.AUTH_MODE, identities);
    if (!match) throw Object.assign(new Error('Team member not found.'), { statusCode: 404 });
    if (match.passwordHash) {
      const stored = await identities.findByEmail(normalized);
      if (!stored) throw Object.assign(new Error('Team member not found.'), { statusCode: 404 });
      await identities.save({
        ...stored,
        displayName: input.displayName,
        role: input.role,
        updatedAt: new Date().toISOString(),
      });
    } else {
      match.identity.displayName = input.displayName;
      match.identity.role = input.role;
    }
    return;
  }
  await cognitoClient(config).send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: config.COGNITO_USER_POOL_ID!,
      Username: normalized,
      UserAttributes: [
        { Name: 'name', Value: input.displayName },
        { Name: 'custom:role', Value: input.role },
        ...(input.phone ? [{ Name: 'phone_number', Value: input.phone }] : []),
      ],
    }),
  );
}

async function ensureDriverResource(fulfillment: FulfillmentRepository, session: Session) {
  if (session.role !== 'DRIVER') return;
  const resources = await fulfillment.listResources(session.tenantId);
  if (resources.some((resource) => resource.id === session.userId)) return;
  const timestamp = new Date().toISOString();
  await fulfillment.saveResource({
    id: session.userId,
    tenantId: session.tenantId,
    name: session.displayName,
    type: 'INTERNAL_DRIVER',
    phone: '+96170000000',
    active: true,
    serviceAreas: ['Lebanon'],
    settlementTerms: 'Daily cash handover',
    createdAt: timestamp,
    updatedAt: timestamp,
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
