import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

let pendingClaim: { lessonId: string; mode: string; payload: string } | null = null;
export function offerLessonClaim(lessonId: string, mode: string, payload: string) { pendingClaim = { lessonId, mode, payload }; }
export function readLessonClaim(lessonId: string, mode: string) {
  if (pendingClaim?.lessonId !== lessonId || pendingClaim.mode !== mode) return null;
  return pendingClaim.payload;
}
export function clearLessonClaim(lessonId: string, mode: string) {
  if (pendingClaim?.lessonId === lessonId && pendingClaim.mode === mode) pendingClaim = null;
}

export function lessonStorageKey(userId: string | undefined, lessonId: string, mode: string) {
  return `zav.lesson.v2.${userId ?? 'guest'}.${lessonId}.${mode}`;
}
export async function readLessonSession(key: string) {
  return Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key);
}
export async function writeLessonSession(key: string, value: string) {
  if (Platform.OS === 'web') localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
