import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { create } from 'zustand';

interface AuthStore {
  token: string | null;
  user: any | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<boolean>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,

  login: async (email, password) => {
    try {
      // API call to backend
      const response = await fetch('https://api.example.com/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      const { token, user } = data;

      // Save token securely
      await SecureStore.setItemAsync('auth_token', token);
      set({ token, user });
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    set({ token: null, user: null });
  },

  enableBiometric: async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) throw new Error('Biometric not supported');

    // Store flag in secure storage
    await SecureStore.setItemAsync('biometric_enabled', 'true');
  },

  authenticateWithBiometric: async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        disableDeviceFallback: false,
      });
      return result.success;
    } catch (error) {
      console.error('Biometric auth failed', error);
      return false;
    }
  },
}));
