'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

// ---- User Identity (Session + UUID fallback) ----

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useUserId(): string {
  const { data: session } = useSession();
  const [fallbackId, setFallbackId] = useState<string>('');

  useEffect(() => {
    // Only generate fallback if not authenticated
    if (!session?.user?.id) {
      let id = localStorage.getItem('burst-user-id');
      if (!id) {
        id = generateUUID();
        localStorage.setItem('burst-user-id', id);
      }
      setFallbackId(id);
    }
  }, [session]);

  // Prefer authenticated userId, fall back to localStorage UUID
  return session?.user?.id || fallbackId;
}

export function useAuthStatus() {
  const { data: session, status } = useSession();
  return {
    isAuthenticated: !!session?.user,
    isLoading: status === 'loading',
    user: session?.user || null,
  };
}

// ---- Polling Hook ----

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled: boolean = true,
): { data: T | null; error: Error | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) return;

    fetchData();

    intervalRef.current = setInterval(fetchData, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, intervalMs, enabled]);

  return { data, error, loading };
}

// ---- API Fetch Helpers ----

export async function fetchDrops(status?: string, sellerId?: string) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (sellerId) params.append('sellerId', sellerId);
  const qs = params.toString();
  const url = qs ? `/api/drops?${qs}` : '/api/drops';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch drops');
  const data = await res.json();
  return data.drops;
}

export async function fetchDrop(dropId: string, userId?: string) {
  const url = userId ? `/api/drops/${dropId}?userId=${encodeURIComponent(userId)}` : `/api/drops/${dropId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch drop');
  return res.json();
}

export async function fetchInventory(dropId: string) {
  const res = await fetch(`/api/drops/${dropId}/inventory`);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  const data = await res.json();
  return data.inventory;
}

export async function fetchReport(dropId: string) {
  const res = await fetch(`/api/drops/${dropId}/report`);
  if (!res.ok) throw new Error('Failed to fetch report');
  const data = await res.json();
  return data.report;
}

export async function claimDrop(dropId: string, userId: string, region: string) {
  const res = await fetch(`/api/drops/${dropId}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, region }),
  });
  return res.json();
}
