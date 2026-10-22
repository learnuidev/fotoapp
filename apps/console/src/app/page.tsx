import { redirect } from 'next/navigation';

/** The console opens on the thing it is for. */
export default function RootPage() {
  redirect('/backends');
}
