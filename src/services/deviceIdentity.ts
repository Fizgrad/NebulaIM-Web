const DEVICE_ID_KEY = "nebulaim-device-id";

export function currentDeviceId() {
  let value = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!value) {
    value = `web-${globalThis.crypto.randomUUID()}`;
    window.localStorage.setItem(DEVICE_ID_KEY, value);
  }
  return value;
}
