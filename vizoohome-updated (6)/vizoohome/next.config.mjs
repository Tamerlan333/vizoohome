export default {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/admin", destination: "/studio", permanent: false }, { source: "/admin/:path*", destination: "/studio", permanent: false }];
  },
};
