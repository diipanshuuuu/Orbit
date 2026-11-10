const STORAGE_KEY = "orbit-feedback-device-id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getFeedbackDeviceId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && UUID.test(existing)) return existing;
  const id = window.crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
