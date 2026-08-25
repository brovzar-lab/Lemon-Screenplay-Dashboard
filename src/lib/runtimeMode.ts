export function isLocalE2E(
  hostname = window.location.hostname,
  enabled = import.meta.env.VITE_E2E === 'true',
): boolean {
  return enabled && (hostname === 'localhost' || hostname === '127.0.0.1');
}
