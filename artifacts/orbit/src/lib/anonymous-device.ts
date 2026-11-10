const STORAGE_KEY = "orbit-anonymous-device-id";
const LEGACY_FEEDBACK_KEY = "orbit-feedback-device-id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getOrCreateAnonymousDeviceId(): string {
  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing && UUID.test(existing)) return existing;

  const legacy = window.localStorage.getItem(LEGACY_FEEDBACK_KEY);
  const id = legacy && UUID.test(legacy) ? legacy : window.crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, id);
  return id;
}
