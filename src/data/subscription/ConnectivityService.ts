/**
 * Whether the device currently has a usable internet connection. Used as a
 * *hint* (skip a pointless RevenueCat call, refresh when the network returns)
 * — never as proof of anything about the subscription.
 */
export interface ConnectivityService {
  isOnline(): Promise<boolean>;
  /** Calls `listener` whenever the online/offline state changes. Returns an unsubscribe function. */
  subscribe(listener: (online: boolean) => void): () => void;
}

/** In-memory stand-in for tests: flip connectivity with `setOnline()`. */
export class FakeConnectivityService implements ConnectivityService {
  private listeners = new Set<(online: boolean) => void>();

  constructor(public online = true) {}

  async isOnline(): Promise<boolean> {
    return this.online;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setOnline(online: boolean): void {
    this.online = online;
    this.listeners.forEach((listener) => listener(online));
  }
}
