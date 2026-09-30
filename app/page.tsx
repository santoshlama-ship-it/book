import DashboardClient from './dashboard-client';
import AccessForm from './access-form';
import BookReviewClient from './book-review-client';
import { getAccessMode } from '@/lib/access';
export default async function HomePage() { const mode = await getAccessMode(); return mode === 'covers' ? <DashboardClient /> : mode === 'books' ? <BookReviewClient /> : <AccessForm />; }
