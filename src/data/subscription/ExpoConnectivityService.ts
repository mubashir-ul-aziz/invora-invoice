import * as Network from 'expo-network';

import type { ConnectivityService } from './ConnectivityService';

function isUsable(state: { isConnected?: boolean; isInternetReachable?: boolean }): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Real implementation over `expo-network`. No Jest coverage — native module; behavior is exercised through `FakeConnectivityService`. */
export class ExpoConnectivityService implements ConnectivityService {
  async isOnline(): Promise<boolean> {
    try {
      return isUsable(await Network.getNetworkStateAsync());
    } catch {
      // Can't tell — let the real call decide rather than assume offline.
      return true;
    }
  }

  subscribe(listener: (online: boolean) => void): () => void {
    let last: boolean | null = null;
    const subscription = Network.addNetworkStateListener((state) => {
      const online = isUsable(state);
      if (online !== last) {
        last = online;
        listener(online);
      }
    });
    return () => subscription.remove();
  }
}
