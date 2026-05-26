import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "STRONG ERP",
    short_name: "STRONG",
    description: "스트롱복싱 운영 관리 시스템",
    start_url: "/login",
    display: "standalone",
    background_color: "#08090d",
    theme_color: "#08090d",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}