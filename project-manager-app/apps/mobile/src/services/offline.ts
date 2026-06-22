import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';

interface OfflineStore {
  isOnline: boolean;
  syncQueue: any[];
  addToQueue: (action: any) => Promise<void>;
  processSyncQueue: () => Promise<void>;
}

export const useOfflineStore = create<OfflineStore>((set, get) => ({
  isOnline: true,
  syncQueue: [],

  addToQueue: async (action) => {
    const queue = get().syncQueue;
    queue.push({ ...action, id: Date.now(), timestamp: new Date() });
    await AsyncStorage.setItem('sync_queue', JSON.stringify(queue));
    set({ syncQueue: queue });
  },

  processSyncQueue: async () => {
    const queue = get().syncQueue;
    const failed = [];

    for (const item of queue) {
      try {
        await fetch(`/v1/${item.endpoint}`, {
          method: item.method,
          body: JSON.stringify(item.data),
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        failed.push(item);
      }
    }

    if (failed.length === 0) {
      await AsyncStorage.removeItem('sync_queue');
      set({ syncQueue: [] });
    } else {
      await AsyncStorage.setItem('sync_queue', JSON.stringify(failed));
      set({ syncQueue: failed });
    }
  },
}));

export const setupNetworkListener = (store: any) => {
  NetInfo.addEventListener((state) => {
    store.isOnline = state.isConnected || false;
    if (state.isConnected) {
      store.processSyncQueue();
    }
  });
};
