import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { AppConfig } from './config.js';

function credentials(connectionString: string) {
  const entries = new Map(
    connectionString
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return [part.slice(0, separator).toLowerCase(), part.slice(separator + 1)] as const;
      }),
  );
  const endpoint = entries.get('endpoint');
  const accessKey = entries.get('accesskey');
  if (!endpoint || !accessKey) throw new Error('Azure email credentials are incomplete.');
  return { endpoint: endpoint.replace(/\/$/, ''), accessKey };
}

export async function sendPasswordResetEmail(config: AppConfig, email: string, code: string) {
  if (!config.AZURE_EMAIL_CONNECTION_STRING || !config.AZURE_EMAIL_SENDER)
    throw new Error('Azure email is not configured.');
  const { endpoint, accessKey } = credentials(config.AZURE_EMAIL_CONNECTION_STRING);
  const url = new URL('/emails:send?api-version=2023-03-31', endpoint);
  const body = JSON.stringify({
    senderAddress: config.AZURE_EMAIL_SENDER,
    content: {
      subject: 'Reset your Masaar password',
      plainText: `Your Masaar password reset code is ${code}. It expires in 15 minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Your Masaar password reset code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:5px">${code}</p><p>It expires in 15 minutes. If you did not request this, you can ignore this email.</p>`,
    },
    recipients: { to: [{ address: email }] },
    userEngagementTrackingDisabled: true,
  });
  const date = new Date().toUTCString();
  const contentHash = createHash('sha256').update(body).digest('base64');
  const stringToSign = `POST\n${url.pathname}${url.search}\n${date};${url.host};${contentHash}`;
  const signature = createHmac('sha256', Buffer.from(accessKey, 'base64'))
    .update(stringToSign)
    .digest('base64');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ms-date': date,
      'x-ms-content-sha256': contentHash,
      authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
      'operation-id': randomUUID(),
    },
    body,
  });
  if (!response.ok) throw new Error(`Azure email rejected the request (${response.status}).`);
}
