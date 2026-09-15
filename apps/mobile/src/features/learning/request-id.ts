// Unique retry key, not an authentication token. Keep it until the request succeeds.
export function studyRequestId() {
  return `study-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
