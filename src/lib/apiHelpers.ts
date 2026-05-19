import { NextResponse } from 'next/server';

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function handleApi(
  fn: () => Promise<Response | NextResponse>,
): Promise<Response | NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api error]', msg);
    return jsonError(msg, 500);
  }
}
