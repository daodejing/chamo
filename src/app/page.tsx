import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to login page
  // In production, this will check for authentication and redirect accordingly
  redirect('/login');
}
