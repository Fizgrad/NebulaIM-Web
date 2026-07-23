const DEVICE_ID_KEY = "nebulaim-device-id";

export function currentDeviceId() {
  let value = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!value) {
    value = `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, value);
  }
  return value;
}
