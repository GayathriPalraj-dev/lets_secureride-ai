import { createHmac } from 'node:crypto';
import https from 'node:https';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const secrets = new SecretsManagerClient({});
let cachedSecret;

async function signingSecret() {
  if (cachedSecret) return cachedSecret;
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.EVENT_SECRET_ID }));
  if (!result.SecretString) throw new Error('secret unavailable');
  cachedSecret = result.SecretString;
  return cachedSecret;
}

function request(body, signature) {
  return new Promise((resolve, reject) => {
    const url = new URL(process.env.EVENT_ENDPOINT);
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        'x-car-image-signature': signature,
      },
      timeout: 10_000,
    }, (res) => {
      res.resume();
      res.on('end', () => res.statusCode === 202 ? resolve() : reject(new Error('delivery rejected')));
    });
    req.on('timeout', () => req.destroy(new Error('delivery timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

export async function handler(event) {
  const detail = event?.detail;
  const object = detail?.s3ObjectDetails;
  if (event?.source !== 'aws.guardduty' ||
      event?.['detail-type'] !== 'GuardDuty Malware Protection Object Scan Result' ||
      object?.bucketName !== process.env.BUCKET_NAME ||
      typeof object?.objectKey !== 'string' ||
      !object.objectKey.startsWith('quarantine/')) throw new Error('event rejected');

  const imageId = object.objectKey.split('/').at(-1);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(imageId))
    throw new Error('event rejected');

  const scanStatus = detail?.scanStatus;
  const scanResult = detail?.scanResultDetails?.scanResultStatus;
  const outcome = scanStatus === 'COMPLETED' && scanResult === 'NO_THREATS_FOUND'
    ? 'clean'
    : scanStatus === 'COMPLETED' && scanResult === 'THREATS_FOUND'
      ? 'threat'
      : scanStatus === 'SKIPPED'
        ? 'unsupported'
        : 'failed';
  const payload = JSON.stringify({
    providerEventId: String(event.id),
    imageId,
    eventTime: String(event.time),
    outcome,
  });
  const signature = createHmac('sha256', await signingSecret()).update(payload).digest('hex');
  await request(payload, signature);
  return { delivered: true };
}
