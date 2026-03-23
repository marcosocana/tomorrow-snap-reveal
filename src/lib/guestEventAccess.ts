const GUEST_EVENT_PASSWORD_KEY = "guestEventPassword";

export const persistGuestEventPassword = (password: string | null | undefined) => {
  const normalizedPassword = password?.trim();
  if (!normalizedPassword) return;
  localStorage.setItem(GUEST_EVENT_PASSWORD_KEY, normalizedPassword);
};

export const getPersistedGuestEventPassword = () => localStorage.getItem(GUEST_EVENT_PASSWORD_KEY);

export const clearPersistedGuestEventPassword = () => {
  localStorage.removeItem(GUEST_EVENT_PASSWORD_KEY);
};
