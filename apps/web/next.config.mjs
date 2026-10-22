/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * The packages are source, not builds: `@foto/*` ships `.ts`/`.tsx` and no
   * `dist/`, so Next compiles them as if they were part of this app. That means
   * one TypeScript program across the app and its packages, and a change to a
   * shared component is a change this app's typecheck sees.
   */
  transpilePackages: ['@foto/types', '@foto/ui', '@foto/api', '@foto/auth'],

  // The packages live outside this app's directory, which webpack allows only
  // when the app says so.
  experimental: { externalDir: true },

  images: {
    /**
     * Photos are served by the API (a presigned or public URL), not by Next's
     * optimiser: they are already the right size for a collage and optimising them
     * again would mean this app proxying every image of every guest's evening.
     */
    unoptimized: true,
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }],
  },
};

export default nextConfig;
