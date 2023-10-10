export const patterns: Record<string, RegExp[]> = {
  date: [
    /\d{1,2}\s*?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*?\d{4}/g,
    /\d{1,2}\s*?(?:January|February|March|April|May|June|July|August|September|October|November|December)/g,
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*?\d{4}/g,
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)/g,
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/g,
  ],
  time: [
    /\d{1,2}(?:[.:]\d{2})?\s?[apAP]\.?m\.?/g,
    /\d{1,2}\s?[apAP]\.?m\.?/g,
    /\d{1,2}\s?noon/g,
    /\d{1,2}(?:[:]\d{2})/g,
  ],
  domain: [
    /\b(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.)+[a-z]{2,}/g,
  ],
  email: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
};
