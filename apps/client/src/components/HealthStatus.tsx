import { useEffect, useState } from 'react';
import type { HealthResponse } from '@lets-secureride-ai/contracts';
import { getHealth } from '../services/health';

type State =
  | { status: 'loading' }
  | { status: 'success'; response: HealthResponse }
  | { status: 'error' };

export function HealthStatus() {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      setState({ status: 'error' });
    }, 10_000);
    void getHealth(controller.signal)
      .then(
        (response) => {
          if (!controller.signal.aborted)
            setState({ status: 'success', response });
        },
        () => {
          if (!controller.signal.aborted) setState({ status: 'error' });
        },
      )
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, []);
  return (
    <section aria-labelledby="health-heading" className="health">
      <h2 id="health-heading">API health</h2>
      {state.status === 'loading' && <p role="status">Checking API health…</p>}
      {state.status === 'error' && (
        <p role="alert">
          Unable to reach the API. Please try refreshing the page.
        </p>
      )}
      {state.status === 'success' && (
        <>
          <p role="status">API is healthy</p>
          <dl>
            <dt>Service</dt>
            <dd>{state.response.data.service}</dd>
            <dt>Environment</dt>
            <dd>{state.response.data.environment}</dd>
            <dt>Checked at</dt>
            <dd>
              <time dateTime={state.response.data.timestamp}>
                {state.response.data.timestamp}
              </time>
            </dd>
            <dt>Uptime</dt>
            <dd>{Math.floor(state.response.data.uptimeSeconds)} seconds</dd>
            <dt>Request ID</dt>
            <dd>{state.response.requestId}</dd>
          </dl>
        </>
      )}
    </section>
  );
}
