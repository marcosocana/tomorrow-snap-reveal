export const EVENT_SHORT_BASE_URL = "https://rvl.to";

export const getEventShortUrl = (passwordHash: string) => {
  return `${EVENT_SHORT_BASE_URL}/${passwordHash}`;
};
