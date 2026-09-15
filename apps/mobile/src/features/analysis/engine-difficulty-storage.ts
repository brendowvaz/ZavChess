import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { parseEngineDifficulty, type EngineDifficulty } from './engine-difficulty';

const KEY = 'zav.engine-difficulty.v1';

export async function loadEngineDifficulty(): Promise<EngineDifficulty> {
  const value = Platform.OS === 'web' ? globalThis.localStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
  return parseEngineDifficulty(value);
}

export async function saveEngineDifficulty(value: EngineDifficulty): Promise<void> {
  if (Platform.OS === 'web') globalThis.localStorage.setItem(KEY, value);
  else await SecureStore.setItemAsync(KEY, value);
}
