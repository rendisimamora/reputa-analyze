import { tryGetUser } from '@/lib/auth';
import { handleApi, jsonOk } from '@/lib/apiHelpers';

export async function GET() {
  return handleApi(async () => {
    const user = await tryGetUser();
    if (!user) return jsonOk({ user: null });
    return jsonOk({ user: { id: user.id, email: user.email, name: user.name } });
  });
}
