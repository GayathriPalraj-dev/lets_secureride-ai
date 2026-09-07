import type {
  AdminPayment,
  AdminPaymentListData,
  AdminPaymentListQuery,
  CustomerPayment,
  PaymentConfirmation,
  PaymentListData,
  PaymentListQuery,
} from '@lets-secureride-ai/contracts';
export class PaymentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super('Payment request failed');
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';
function payment(
  value: unknown,
  admin = false,
): CustomerPayment | AdminPayment {
  if (
    !record(value) ||
    typeof value.id !== 'string' ||
    typeof value.bookingId !== 'string' ||
    !record(value.amount) ||
    !Number.isSafeInteger(value.amount.amountMinor) ||
    value.amount.currency !== 'INR' ||
    typeof value.status !== 'string' ||
    typeof value.refundStatus !== 'string' ||
    !Number.isInteger(value.revision) ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  )
    throw new PaymentError(503, 'INVALID_RESPONSE');
  if (
    admin &&
    (typeof value.customerReference !== 'string' ||
      !record(value.booking) ||
      typeof value.reconciliationState !== 'string' ||
      typeof value.retryEligible !== 'boolean')
  )
    throw new PaymentError(503, 'INVALID_RESPONSE');
  return value as unknown as CustomerPayment | AdminPayment;
}
const query = (value: object) => {
  const params = new URLSearchParams();
  Object.entries(value).forEach(([key, item]) => {
    if (item !== undefined && item !== '') params.set(key, String(item));
  });
  return params.size ? '?' + params : '';
};
export function createPaymentRequests() {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(
    /\/$/,
    '',
  );
  async function request(
    path: string,
    method: string,
    token: string,
    body?: unknown,
    revision?: number,
  ) {
    let response: Response;
    try {
      response = await fetch(base + '/' + path, {
        method,
        credentials: 'include',
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
          ...(body !== undefined
            ? { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' }
            : {}),
          ...(revision !== undefined ? { 'If-Match': `"${revision}"` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new PaymentError(503, 'NETWORK_UNAVAILABLE');
    }
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw new PaymentError(503, 'INVALID_RESPONSE');
    }
    if (!response.ok)
      throw new PaymentError(
        response.status,
        record(envelope) &&
          record(envelope.error) &&
          typeof envelope.error.code === 'string'
          ? envelope.error.code
          : 'PAYMENT_REQUEST_FAILED',
      );
    if (
      !record(envelope) ||
      envelope.success !== true ||
      !record(envelope.data)
    )
      throw new PaymentError(503, 'INVALID_RESPONSE');
    return envelope.data;
  }
  const list = (data: Record<string, unknown>, admin = false) => {
    if (
      !Array.isArray(data.items) ||
      !['page', 'pageSize', 'totalItems', 'totalPages'].every((key) =>
        Number.isInteger(data[key]),
      )
    )
      throw new PaymentError(503, 'INVALID_RESPONSE');
    return { ...data, items: data.items.map((item) => payment(item, admin)) };
  };
  return {
    start: async (token: string, bookingId: string, revision: number) => {
      const data = await request(
        `bookings/${encodeURIComponent(bookingId)}/payment-session`,
        'POST',
        token,
        {},
        revision,
      );
      const result: {
        payment: CustomerPayment;
        confirmation?: PaymentConfirmation;
      } = { payment: payment(data.payment) as CustomerPayment };
      if (
        record(data.confirmation) &&
        typeof data.confirmation.publishableKey === 'string' &&
        typeof data.confirmation.clientSecret === 'string'
      )
        result.confirmation =
          data.confirmation as unknown as PaymentConfirmation;
      return result;
    },
    byBooking: async (token: string, bookingId: string) =>
      payment(
        (
          await request(
            `bookings/${encodeURIComponent(bookingId)}/payment`,
            'GET',
            token,
          )
        ).payment,
      ) as CustomerPayment,
    detail: async (token: string, id: string) =>
      payment(
        (await request(`payments/${encodeURIComponent(id)}`, 'GET', token))
          .payment,
      ) as CustomerPayment,
    list: async (token: string, values: PaymentListQuery = {}) =>
      list(
        await request('payments' + query(values), 'GET', token),
      ) as PaymentListData,
    adminList: async (token: string, values: AdminPaymentListQuery = {}) =>
      list(
        await request('admin/payments' + query(values), 'GET', token),
        true,
      ) as AdminPaymentListData,
    adminDetail: async (token: string, id: string) =>
      payment(
        (
          await request(
            `admin/payments/${encodeURIComponent(id)}`,
            'GET',
            token,
          )
        ).payment,
        true,
      ) as AdminPayment,
    adminAction: async (
      token: string,
      id: string,
      revision: number,
      action: 'reconcile' | 'refund',
      reason?: string,
    ) =>
      payment(
        (
          await request(
            `admin/payments/${encodeURIComponent(id)}/${action}`,
            'POST',
            token,
            reason ? { reason } : {},
            revision,
          )
        ).payment,
        true,
      ) as AdminPayment,
  };
}
export type PaymentRequests = ReturnType<typeof createPaymentRequests>;
