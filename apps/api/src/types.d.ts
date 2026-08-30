import type { Session } from '@masaar/contracts';

declare module 'fastify' {
  interface FastifyRequest {
    session: Session | null;
    correlationId: string;
  }
}
