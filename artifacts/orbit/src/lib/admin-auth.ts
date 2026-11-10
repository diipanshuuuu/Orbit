export const ADMIN_KEY = "orbit-admin-passcode";

export function readPasscode(): string | null {
  try {
    const v = localStorage.getItem(ADMIN_KEY);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function rememberPasscode(p: string) {
  try { localStorage.setItem(ADMIN_KEY, p); } catch { /* storage unavailable */ }
}

export function forgetPasscode() {
  try { localStorage.removeItem(ADMIN_KEY); } catch { /* storage unavailable */ }
}

export function adminRequest(passcode: string): RequestInit {
  return { headers: { Authorization: "Bearer " + passcode }, cache: "no-store" };
}

export function errorStatus(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err) {
    const s = (err as { status: unknown }).status;
    return typeof s === "number" ? s : null;
  }
  return null;
}

export function errorMessage(err: unknown): string {
  const s = errorStatus(err);
  if (s === 401) return "Passcode rejected.";
  if (s === 503) return "Admin is not configured on the server (ADMIN_PASSCODE missing).";
  if (err && typeof err === "object" && "data" in err) {
    const d = (err as { data: unknown }).data;
    if (d && typeof d === "object" && "error" in d && typeof (d as { error: unknown }).error === "string") {
      return (d as { error: string }).error;
    }
  }
  if (s) return "Server error (" + s + "). Try again.";
  return "Network error. Check your connection.";
}

export function cameraUrl(path: string) {
  return window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "") + path;
}
