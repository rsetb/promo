import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Empacota só o necessário para rodar, em vez da node_modules inteira:
  // a imagem Docker do EasyPanel fica bem menor.
  output: 'standalone',

  experimental: {
    // O padrão é 1 MB, e foto de celular tem 3-5 MB: sem isto, o upload falha
    // com um erro obscuro. O limite de 10 MB casa com o de src/lib/uploads.ts,
    // que recusa com uma mensagem legível antes de processar.
    serverActions: { bodySizeLimit: '10mb' },
  },

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
