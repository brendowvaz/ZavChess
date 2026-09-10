import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'zav.session';
// Never fall back to unencrypted storage on a device or persistent localStorage on web.
export const tokenStorage = {
  async read() { return Platform.OS === 'web' ? globalThis.sessionStorage.getItem(KEY) : SecureStore.getItemAsync(KEY); },
  async write(token: string) {
    if (Platform.OS === 'web') globalThis.sessionStorage.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  async clear() {
    if (Platform.OS === 'web') globalThis.sessionStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  },
};
