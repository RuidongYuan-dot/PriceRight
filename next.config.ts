import type { NextConfig } from "next";

/**
 * Hosting prefix for static export.
 * Unset or empty for local dev, CI, and root-domain builds.
 * GitHub Pages project site: NEXT_PUBLIC_BASE_PATH=/PriceRight
 * Empty, or a slash-prefixed path with no trailing slash.
 */
function readBasePath(): string {
  const value = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
  if (value === "") return "";
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+$/.test(value)) {
    throw new Error(
      `NEXT_PUBLIC_BASE_PATH must be empty or a slash-prefixed path without a trailing slash. Received ${JSON.stringify(process.env.NEXT_PUBLIC_BASE_PATH)}.`,
    );
  }
  return value;
}

const basePath = readBasePath();

const config: NextConfig = {
  agentRules: false,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
};

export default config;
