import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Without this Turbopack walks up to C:\Users\IkramCC, finds a stray
  // package-lock.json there and warns that it would treat the home directory
  // as the project root. Pin the root to this project.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
