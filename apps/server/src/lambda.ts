import serverlessExpressModule from '@codegenie/serverless-express';
import type { RequestListener } from 'node:http';
import { bootstrapApplication } from './bootstrap.js';
import { loadRuntimeConfiguration } from './config/runtime-config.js';

type LambdaAdapter = (event: unknown, context: unknown) => Promise<unknown>;
const serverlessExpress = serverlessExpressModule as unknown as (options: {
  app: RequestListener;
  respondWithErrors: boolean;
  binarySettings: { contentTypes: string[]; contentEncodings: string[] };
}) => LambdaAdapter;

let application: Awaited<ReturnType<typeof bootstrapApplication>> | undefined;
let adapter: LambdaAdapter | undefined;
let initialization: Promise<LambdaAdapter> | undefined;

async function initialize(): Promise<LambdaAdapter> {
  const parameterName = process.env.SECURERIDE_CONFIG_PARAMETER ?? '';
  const expectedOrigin = process.env.EXPECTED_CLIENT_ORIGIN ?? '';
  const environment = await loadRuntimeConfiguration(
    parameterName,
    expectedOrigin,
  );
  application = await bootstrapApplication(environment, { lambda: true });
  await application.database.connectDatabase();
  adapter = serverlessExpress({
    app: application.app,
    respondWithErrors: false,
    binarySettings: {
      contentTypes: ['image/*'],
      contentEncodings: ['gzip', 'br'],
    },
  }) as LambdaAdapter;
  return adapter;
}

function getAdapter() {
  if (adapter) return Promise.resolve(adapter);
  initialization ??= initialize().catch(() => {
    initialization = undefined;
    application = undefined;
    adapter = undefined;
    throw new Error('Lambda initialization failed');
  });
  return initialization;
}

export async function handler(event: unknown, context: unknown) {
  const invoke = await getAdapter();
  return invoke(event, context);
}

export function resetLambdaStateForTests() {
  application = undefined;
  adapter = undefined;
  initialization = undefined;
}
