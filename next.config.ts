import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Empacota só o necessário para rodar, em vez da node_modules inteira:
  // a imagem Docker do EasyPanel fica bem menor.
  output: 'standalone',

  // O projeto vinha com `ignoreBuildErrors: true`, o que deixava erros de tipo
  // e de lint passarem direto para produção. Um build que falha é o objetivo.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
