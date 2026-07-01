import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export type ConnectivityState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  lastOfflineAt?: string;
  lastOnlineAt?: string;
};

const ConnectivityContext = createContext<ConnectivityState | undefined>(undefined);

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConnectivityState>({
    isConnected: true,
    isInternetReachable: null,
  });

  useEffect(() => {
    let mounted = true;

    NetInfo.fetch().then((snapshot) => {
      if (!mounted) return;
      const connected = Boolean(snapshot.isConnected);
      setState({
        isConnected: connected,
        isInternetReachable: snapshot.isInternetReachable,
        lastOfflineAt: connected ? undefined : new Date().toISOString(),
        lastOnlineAt: connected ? new Date().toISOString() : undefined,
      });
    }).catch(() => {});

    const unsubscribe = NetInfo.addEventListener((snapshot) => {
      const connected = Boolean(snapshot.isConnected);
      setState((prev) => ({
        isConnected: connected,
        isInternetReachable: snapshot.isInternetReachable,
        lastOfflineAt: !connected ? new Date().toISOString() : prev.lastOfflineAt,
        lastOnlineAt: connected ? new Date().toISOString() : prev.lastOnlineAt,
      }));
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity(): ConnectivityState {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
}
