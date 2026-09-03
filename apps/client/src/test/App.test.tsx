import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';

const health = {
  success: true,
  data: {
    service: 'lets-secureride-ai-api',
    status: 'ok',
    timestamp: '2026-09-03T00:00:00.000Z',
    uptimeSeconds: 42,
    environment: 'test',
  },
  requestId: 'test-request',
};
function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}

describe('foundation page', () => {
  it('renders the exact application heading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    renderApp();
    expect(
      screen.getByRole('heading', { name: 'lets_secureride-ai', level: 1 }),
    ).toBeInTheDocument();
  });
  it('announces loading while the request is pending', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent('Checking API health');
  });
  it('shows a successful response and calls the versioned endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => health });
    vi.stubGlobal('fetch', fetchMock);
    renderApp();
    expect(await screen.findByText('API is healthy')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByText('lets-secureride-ai-api')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it('announces network failure accessibly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network unavailable')),
    );
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the API',
    );
  });
  it('handles an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to reach the API',
    );
  });
  it('rejects an invalid successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      }),
    );
    renderApp();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
