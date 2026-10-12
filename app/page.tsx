import { getDB } from '@/lib/db';
import { AdminPanel } from '@/components/AdminPanel';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const initialData = getDB();

  return <AdminPanel initialData={initialData} />;
}
