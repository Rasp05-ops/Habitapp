/** Accepts "98765 43210", "+91 98765 43210", "09876543210" and returns E.164, or null when it can't be valid. */
export function toE164(raw: string): string | null {
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    s = s.replace(/^0+/, "");
    if (/^[6-9]\d{9}$/.test(s)) s = "+91" + s;            // bare Indian mobile number
    else return null;
  }
  return /^\+[1-9]\d{9,14}$/.test(s) ? s : null;
}
