import { spawnSync } from 'node:child_process';
import Stripe from 'stripe';

const required = ['RUNTIME_SECRET_ID', 'EVENT_SECRET_ID', 'BUCKET_NAME', 'DISTRIBUTION_DOMAIN'];
if (required.some((name) => !process.env[name])) throw new Error('bootstrap configuration missing');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
let endpoint;
try {
  endpoint = await stripe.webhookEndpoints.create({
    url: `https://${process.env.DISTRIBUTION_DOMAIN}/api/v1/payments/webhook`,
    description: 'Temporary Step 9 acceptance webhook',
    enabled_events: [
      'payment_intent.processing', 'payment_intent.succeeded',
      'payment_intent.payment_failed', 'payment_intent.canceled',
      'refund.created', 'refund.updated', 'refund.failed',
    ],
  });
  if (!endpoint.secret?.startsWith('whsec_')) throw new Error('webhook secret unavailable');
  const secretResult = spawnSync(process.env.AWS_EXE || 'aws', [
    'secretsmanager', 'get-secret-value', '--secret-id', process.env.EVENT_SECRET_ID,
    '--query', 'SecretString', '--output', 'text', '--profile', 'secureride-provisioner', '--region', 'ap-south-1',
  ], { encoding: 'utf8' });
  if (secretResult.status !== 0 || !secretResult.stdout.trim()) throw new Error('event secret unavailable');
  const runtime = {
    NODE_ENV: 'production', PORT: '5000', CLIENT_ORIGIN: `https://${process.env.DISTRIBUTION_DOMAIN}`,
    LOG_LEVEL: 'info', MONGODB_URI: process.env.MONGODB_URI,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET, JWT_ACCESS_KEY_ID: process.env.JWT_ACCESS_KEY_ID,
    JWT_ISSUER: process.env.JWT_ISSUER, JWT_AUDIENCE: process.env.JWT_AUDIENCE,
    AUTH_RATE_LIMIT_SECRET: process.env.AUTH_RATE_LIMIT_SECRET,
    AUTH_ACCESS_TTL_SECONDS: process.env.AUTH_ACCESS_TTL_SECONDS,
    AUTH_REFRESH_IDLE_SECONDS: process.env.AUTH_REFRESH_IDLE_SECONDS,
    AUTH_REFRESH_ABSOLUTE_SECONDS: process.env.AUTH_REFRESH_ABSOLUTE_SECONDS,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    STRIPE_WEBHOOK_SECRET: endpoint.secret,
    AWS_REGION: 'ap-south-1', CAR_IMAGE_BUCKET: process.env.BUCKET_NAME,
    CAR_IMAGE_EVENT_SECRET: secretResult.stdout.trim(), STRIPE_ENDPOINT_ID: endpoint.id,
  };
  const stored = spawnSync(process.env.AWS_EXE || 'aws', [
    'secretsmanager', 'put-secret-value', '--secret-id', process.env.RUNTIME_SECRET_ID,
    '--secret-string', 'fileb://-', '--profile', 'secureride-provisioner', '--region', 'ap-south-1', '--output', 'json',
  ], { input: JSON.stringify(runtime), encoding: 'utf8', stdio: ['pipe', 'ignore', 'ignore'] });
  if (stored.status !== 0) throw new Error('runtime secret storage failed');
  process.stdout.write('STRIPE_WEBHOOK_BOOTSTRAP_PASS\n');
} catch {
  if (endpoint?.id) await stripe.webhookEndpoints.del(endpoint.id).catch(() => undefined);
  process.stdout.write('STRIPE_WEBHOOK_BOOTSTRAP_FAILED\n');
  process.exitCode = 1;
}
