import { getSession } from '@/lib/auth';
import { handleApi, jsonOk } from '@/lib/apiHelpers';

export async function POST() {
  return handleApi(async () => {
    const session = await getSession();
    session.destroy();
    return jsonOk({ ok: true });
  });
}
