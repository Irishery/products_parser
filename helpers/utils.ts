// utils.ts

export const getTime = (): string => {
  const now = new Date();
  const pad = (n: number): string => (n < 10 ? "0" + n : n.toString());
  return (
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    " " +
    pad(now.getHours()) +
    ":" +
    pad(now.getMinutes())
  );
};

export const fixUrl = (link: string, baseUrl: string): string => {
  if (!link || link.trim() === "#" || link.trim().length <= 1) return "";
  try {
    const base = new URL(baseUrl);
    return new URL(link, base.origin).href;
  } catch (e) {
    return "";
  }
};

export const convertString = (s: string): string => {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/'/g, "&quot;")
    .replace(/«/g, "&quot;")
    .replace(/»/g, "&quot;");
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const log = (msg: string): void => {
  console.log("\x1b[32m%s\x1b[0m", msg);
};

export const err = (msg: string): void => {
  console.error("\x1b[31m%s\x1b[0m", msg);
};
