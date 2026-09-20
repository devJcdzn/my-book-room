import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  hasProEntitlement,
  presentProPaywall,
  restoreProPurchases,
} from '@/src/services/revenuecat';

export type ProAccessStatus = 'checking' | 'free' | 'pro';

type ProAccessContextValue = {
  status: ProAccessStatus;
  isPro: boolean;
  isPending: boolean;
  requestProAccess: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshProAccess: () => Promise<boolean>;
};

const ProAccessContext = createContext<ProAccessContextValue | null>(null);

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ProAccessStatus>('checking');
  const [pendingOperation, setPendingOperation] = useState<'paywall' | 'restore' | null>(null);
  const pendingPromiseRef = useRef<Promise<boolean> | null>(null);

  const refreshProAccess = useCallback(async () => {
    const hasPro = await hasProEntitlement().catch(() => false);
    setStatus(hasPro ? 'pro' : 'free');
    return hasPro;
  }, []);

  useEffect(() => {
    let isMounted = true;
    void hasProEntitlement().then((hasPro) => {
      if (isMounted) setStatus(hasPro ? 'pro' : 'free');
    });
    return () => { isMounted = false; };
  }, []);

  const requestProAccess = useCallback(async () => {
    if (status === 'pro') return true;
    if (pendingPromiseRef.current) return pendingPromiseRef.current;

    const operation = (async () => {
      setPendingOperation('paywall');
      const unlocked = await presentProPaywall();
      if (unlocked) setStatus('pro');
      return unlocked;
    })().catch(() => false).finally(() => {
      pendingPromiseRef.current = null;
      setPendingOperation(null);
    });

    pendingPromiseRef.current = operation;
    return operation;
  }, [status]);

  const restorePurchases = useCallback(async () => {
    if (pendingPromiseRef.current) return pendingPromiseRef.current;

    const operation = (async () => {
      setPendingOperation('restore');
      const restored = await restoreProPurchases();
      setStatus(restored ? 'pro' : 'free');
      return restored;
    })().catch(() => {
      setStatus('free');
      return false;
    }).finally(() => {
      pendingPromiseRef.current = null;
      setPendingOperation(null);
    });

    pendingPromiseRef.current = operation;
    return operation;
  }, []);

  const value = useMemo<ProAccessContextValue>(() => ({
    status,
    isPro: status === 'pro',
    isPending: status === 'checking' || pendingOperation !== null,
    requestProAccess,
    restorePurchases,
    refreshProAccess,
  }), [pendingOperation, refreshProAccess, requestProAccess, restorePurchases, status]);

  return <ProAccessContext.Provider value={value}>{children}</ProAccessContext.Provider>;
}

export function useProAccess() {
  const value = useContext(ProAccessContext);
  if (!value) throw new Error('useProAccess must be used within RevenueCatProvider');
  return value;
}
