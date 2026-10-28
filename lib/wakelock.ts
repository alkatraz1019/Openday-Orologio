/** Screen Wake Lock: tiene lo schermo acceso (utile per il proiettore / tablet). */
let sentinel: { release: () => Promise<void>; addEventListener?: (t: string, l: () => void) => void } | null =
  null;

export async function requestWakeLock(): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: string) => Promise<any> } };
    if (!nav.wakeLock) return false;
    sentinel = await nav.wakeLock.request("screen");
    sentinel?.addEventListener?.("release", () => {
      sentinel = null;
    });
    return true;
  } catch {
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await sentinel?.release();
  } catch {
    /* ignora */
  }
  sentinel = null;
}
