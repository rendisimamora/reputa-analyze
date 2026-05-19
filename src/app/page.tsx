import { redirect } from 'next/navigation';
import { tryGetUser } from '@/lib/auth';

export default async function Index() {
  const user = await tryGetUser();
  redirect(user ? '/projects' : '/login');
}
