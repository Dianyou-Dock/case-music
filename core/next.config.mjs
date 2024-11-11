export default {
  experimental: {
    optimizePackageImports: ["@chakra-ui/react"],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/all",
        permanent: true,
      },
    ];
  },
};
