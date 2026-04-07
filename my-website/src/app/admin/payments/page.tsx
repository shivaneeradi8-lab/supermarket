'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type FailureItem = {
  _id: string;
  provider: string;
  providerEventId: string;
  orderId?: string;
  eventType: string;
  outcome: string;
  status?: string;
  reason?: string;
  amount?: number;
  createdAt: string;
};

type FailureResponse = {
  success: boolean;
  message?: string;
  data?: {
    window: {
      minutes: number;
      since: string;
    };
    threshold: {
      threshold: number;
      windowSeconds: number;
      failureCount: number;
      thresholdExceeded: boolean;
      windowStartedAt: string;
      windowEndedAt: string;
    };
    summary: {
      totalFailures: number;
      byProvider: Array<{ provider: string; count: number }>;
      byReason: Array<{ reason: string; count: number }>;
    };
    items: FailureItem[];
  };
};

export default function AdminPaymentMonitoringPage() {
  const [minutes, setMinutes] = useState(60);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [payload, setPayload] = useState<FailureResponse['data'] | null>(null);

  const token = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('greencart_token') || '';
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams({
        minutes: String(minutes),
        limit: String(limit),
      });

      const res = await fetch(`/api/admin/payments/failures?${query.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data: FailureResponse = await res.json();
      if (!res.ok || !data.success || !data.data) {
        setError(data.message || 'Failed to load monitoring data');
        setPayload(null);
        return;
      }

      setPayload(data.data);
    } catch {
      setError('Failed to load monitoring data');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [limit, minutes, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Payment Failure Monitoring</h1>
            <p className="text-sm text-gray-600">Operational visibility for recent payment failures and alert thresholds.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-700">Minutes</label>
            <input
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value) || 60)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />

            <label className="text-sm text-gray-700">Limit</label>
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
              className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
            />

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {payload && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded bg-white p-4 shadow-sm border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Total Failures</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{payload.summary.totalFailures}</p>
              </div>

              <div className="rounded bg-white p-4 shadow-sm border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Threshold</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{payload.threshold.threshold}</p>
              </div>

              <div className="rounded bg-white p-4 shadow-sm border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Window</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{Math.floor(payload.threshold.windowSeconds / 60)}m</p>
              </div>

              <div className="rounded bg-white p-4 shadow-sm border border-gray-100">
                <p className="text-xs uppercase tracking-wide text-gray-500">Alert State</p>
                <p className={`mt-2 text-2xl font-semibold ${payload.threshold.thresholdExceeded ? 'text-red-600' : 'text-emerald-600'}`}>
                  {payload.threshold.thresholdExceeded ? 'Triggered' : 'Normal'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded bg-white p-4 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">By Provider</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {payload.summary.byProvider.length === 0 && <li>No failures in selected window.</li>}
                  {payload.summary.byProvider.map((item) => (
                    <li key={`${item.provider}-${item.count}`} className="flex items-center justify-between">
                      <span>{item.provider || 'unknown'}</span>
                      <span className="font-medium">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded bg-white p-4 shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">By Reason</h2>
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {payload.summary.byReason.length === 0 && <li>No failures in selected window.</li>}
                  {payload.summary.byReason.map((item) => (
                    <li key={`${item.reason}-${item.count}`} className="flex items-center justify-between">
                      <span>{item.reason || 'unknown'}</span>
                      <span className="font-medium">{item.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="overflow-x-auto rounded bg-white shadow-sm border border-gray-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.items.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={6}>No failure events found.</td>
                    </tr>
                  )}

                  {payload.items.map((item) => (
                    <tr key={item._id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-600">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2 font-medium text-gray-800">{item.provider}</td>
                      <td className="px-3 py-2 text-gray-700">{item.eventType}</td>
                      <td className="px-3 py-2 text-gray-700">{item.orderId || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{item.reason || '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{typeof item.amount === 'number' ? item.amount.toFixed(2) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
