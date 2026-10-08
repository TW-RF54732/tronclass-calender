const encoder = new TextEncoder();
const COOKIE = "__Host-tronclass";
const MAX_AGE = 7 * 24 * 60 * 60;
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [first, second] = await Promise.all([a, b].map(value => crypto.subtle.digest("SHA-256", encoder.encode(value))));
  const x = new Uint8Array(first), y = new Uint8Array(second);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}
async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`tronclass-web-cookie-v1:${payload}`));
  return [...new Uint8Array(signature)].map(v => v.toString(16).padStart(2, "0")).join("");
}
export async function loginCookie(secret: string, now = Date.now()): Promise<string> {
  const payload = `${Math.floor(now / 1000) + MAX_AGE}.${crypto.randomUUID()}`;
  return `${COOKIE}=${payload}.${await sign(payload, secret)}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
export function logoutCookie(): string { return `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`; }
export async function authenticated(request: Request, secret: string, now = Date.now()): Promise<boolean> {
  if (!secret) return false;
  const cookie = request.headers.get("Cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!cookie) return false;
  const parts = cookie.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-f\d-]{36}$/.test(parts[1]) || !/^[a-f\d]{64}$/.test(parts[2])) return false;
  const expiry = Number(parts[0]);
  if (expiry <= now / 1000 || expiry > now / 1000 + MAX_AGE + 60) return false;
  return sameSecret(parts[2], await sign(`${parts[0]}.${parts[1]}`, secret));
}
