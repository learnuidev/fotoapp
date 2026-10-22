/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app shells out to `cdk` and spawns the product's dev server, so nothing
  // here is ever prerendered: every page reads the machine it is running on.
  experimental: {},
};

export default nextConfig;
