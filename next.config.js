/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir:
    process.env.ADMIN_PANEL_TEST_INSTANCE === 'rechecking'
      ? '.next-rechecking-test'
      : '.next',
  outputFileTracingIncludes: {
    '/api/**': ['./data/**/*'],
  },
};

module.exports = nextConfig;

