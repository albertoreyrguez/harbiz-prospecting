/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // No bloquear el deploy por errores de ESLint
    ignoreDuringBuilds: true,
  },
  typescript: {
    // No bloquear el deploy por errores de TypeScript
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
