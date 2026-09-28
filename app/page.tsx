import DashboardClient from './dashboard-client';
import AccessForm from './access-form';
import { hasAccess } from '@/lib/access';
export default async function HomePage() { return await hasAccess() ? <DashboardClient /> : <AccessForm />; }
