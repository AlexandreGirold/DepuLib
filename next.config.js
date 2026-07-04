// Charge la clé LLMaaS depuis .env ou ../.env avant le build/dev.
try {
  require("./scripts/loadenv.cjs").loadEnv();
} catch (e) {
  // no-op : en prod (Docker) les variables viennent de l'environnement
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "@prisma/client"]
  },
  webpack: (config, { webpack }) => {
    const path = require("path");
    config.module.rules.push({
      test: /\.(woff2?|ttf|eot)$/,
      type: "asset/resource"
    });
    // Remplace dsfr_plus_icons.scss (qui @use dsfr.min.css entier → stack overflow
    // sass) par un stub vide. Le CSS DSFR est chargé via <link> depuis /public/dsfr.
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /dsfr_plus_icons\.scss$/,
        path.resolve(__dirname, "stubs/empty.scss")
      )
    );
    return config;
  }
};

module.exports = nextConfig;
