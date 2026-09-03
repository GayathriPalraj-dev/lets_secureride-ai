import type { HealthResponse } from '@lets-secureride-ai/contracts';

function isHealthResponse(value: unknown): value is HealthResponse {
  if (!value || typeof value !== 'object') return false;
  if (
    !('success' in value) ||
    value.success !== true ||
    !('requestId' in value) ||
    typeof value.requestId !== 'string' ||
    !value.requestId ||
    !('data' in value) ||
    !value.data ||
    typeof value.data !== 'object'
  )
    return false;
  const data = value.data;
  return (
    'service' in data &&
    data.service === 'lets-secureride-ai-api' &&
    'status' in data &&
    data.status === 'ok' &&
    'timestamp' in data &&
    typeof data.timestamp === 'string' &&
    Number.isFinite(Date.parse(data.timestamp)) &&
    'uptimeSeconds' in data &&
    typeof data.uptimeSeconds === 'number' &&
    Number.isFinite(data.uptimeSeconds) &&
    data.uptimeSeconds >= 0 &&
    'environment' in data &&
    ['development', 'test', 'production'].includes(String(data.environment))
  );
}

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
    /\/$/,
    '',
  );
  const response = await fetch(base + '/health', {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Health request failed');
  const body: unknown = await response.json();
  if (!isHealthResponse(body)) throw new Error('Unexpected health response');
  return body;
}
