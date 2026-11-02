// APP_URL pins the public origin when TLS terminates at Railway's proxy.
export function hasSameOrigin(request: Request, appUrl = process.env.APP_URL): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return origin === new URL(appUrl || request.url).origin;
  } catch {
    return false;
  }
}

export function requestClientIp(request: Request, railway = Boolean(process.env.RAILWAY_ENVIRONMENT_ID)): string {
  // Railway's HTTP edge supplies X-Real-IP; Cloudflare supplies CF-Connecting-IP.
  return request.headers.get(railway ? 'x-real-ip' : 'cf-connecting-ip') || 'anonymous';
}
