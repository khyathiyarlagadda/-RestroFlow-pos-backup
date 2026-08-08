import { useState, useEffect } from 'react';
import { networkManager } from '../utils/networkManager';

/**
 * React Hook for accessing global network status.
 * Uses centralized networkManager state and subscriptions.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => networkManager.isOnline);

  useEffect(() => {
    const unsubscribe = networkManager.subscribe((status) => {
      setIsOnline(status);
    });
    return unsubscribe;
  }, []);

  return isOnline;
}
