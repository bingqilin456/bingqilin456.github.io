import type { ApiFailure } from "#shared/contracts";

export class AppError extends Error {
  status: number; code: string; retryAt?: number;
  constructor(status: number, code: string, message: string, retryAt?: number) {
    super(message); this.status = status; this.code = code; this.retryAt = retryAt;
  }
}
export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function errorResponse(error: unknown): Response {
  const safe = error instanceof AppError ? error : new AppError(500, "INTERNAL_ERROR", "请求暂时无法完成，请稍后重试。");
  const body: ApiFailure = { error: { code: safe.code, message: safe.message, requestId: crypto.randomUUID(), ...(safe.retryAt ? { retryAt: safe.retryAt } : {}) } };
  return jsonResponse(body, safe.status);
}
