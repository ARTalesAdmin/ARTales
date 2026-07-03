const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "**.supabase.co";

const nextConfig = {
  experimental: {
    serverActions: {
      // Large literary works can exceed the default 1 MB Server Action payload
      // once content_blocks are submitted from the block editor. Keep this high
      // enough for long public-domain works, but not unlimited.
      bodySizeLimit: "32mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/artales-images/**",
      },
    ],
  },
};

export default nextConfig;
