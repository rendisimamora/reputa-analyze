/**
 * Logout — with JWT auth this is a client-side no-op (just delete the token).
 * We keep the endpoint for symmetry: returns 200 so the client UI can confirm.
 *
 * If you need true server-side revocation, add a `tokenVersion` column to User
 * and bump it here. requireUser() would then check the version embedded in the
 * JWT against the DB row.
 */
import { handleApi, jsonOk } from '@/lib/apiHelpers';

export async function POST() {
  return handleApi(async () => {
    return jsonOk({ ok: true });
  });
}
