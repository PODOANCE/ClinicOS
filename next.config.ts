import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (lectura de facturas) usa pdfjs-dist + el binario nativo de
  // @napi-rs/canvas para DOMMatrix; si Next los empaqueta con webpack en vez
  // de dejarlos como paquetes externos de servidor, pierden el entorno y
  // fallan con "DOMMatrix is not defined".
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
};

export default nextConfig;
