import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Il progetto vive dentro la home: pin della root per Turbopack, così i
  // lockfile fuori dal repo (es. /Users/auvi/package-lock.json) vengono ignorati.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
