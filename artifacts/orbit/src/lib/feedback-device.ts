import { getOrCreateAnonymousDeviceId } from "./anonymous-device";

export function getFeedbackDeviceId(): string {
  return getOrCreateAnonymousDeviceId();
}
