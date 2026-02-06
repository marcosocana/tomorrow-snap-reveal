// Generate or retrieve a unique device identifier
export const getDeviceId = (): string => {
  const STORAGE_KEY = "device_id";
  
  let deviceId = localStorage.getItem(STORAGE_KEY);
  
  if (!deviceId) {
    // Generate a UUID-like identifier
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  
  return deviceId;
};
