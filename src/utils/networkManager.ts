/**
 * Centralized Network Manager for Internet Connectivity Detection
 * Maintains global application state (isOnline: true/false)
 * Accessible throughout the application for future Offline Storage and Auto Sync modules.
 */

type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkManager {
  private _isOnline: boolean;
  private listeners: Set<NetworkStatusListener> = new Set();

  constructor() {
    this._isOnline =
      typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    this._isOnline = true;
    this.notifyListeners();
  };

  private handleOffline = () => {
    this._isOnline = false;
    this.notifyListeners();
  };

  private notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this._isOnline);
      } catch (err) {
        console.error('Error in network status listener:', err);
      }
    });
  }

  /**
   * Returns current online status (true = online, false = offline)
   */
  public get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Subscribe to online/offline network status changes.
   * Returns an unsubscribe function.
   */
  public subscribe(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Cleanup event listeners
   */
  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.listeners.clear();
  }
}

// Export global singleton instance initialized when application starts
export const networkManager = new NetworkManager();
export default networkManager;
