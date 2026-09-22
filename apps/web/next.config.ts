import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/brand/**",
      },
      {
        pathname: "/materials/**",
        search: "?v=2",
      },
    ],
  },
};

export default nextConfig;
