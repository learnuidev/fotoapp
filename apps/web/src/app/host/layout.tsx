import { AuthGate } from '@foto/auth';
import { SiteHeader } from '@/components/site-header';

/**
 * The console's shell.
 *
 * The gate is here rather than on each page, so a page added under `/host` inherits
 * the answer to "may this person see this" and cannot forget to ask.
 */
export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <AuthGate>
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 pb-24">{children}</main>
      </AuthGate>
    </div>
  );
}
