import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Evita que un package-lock ajeno en el perfil de Windows convierta
  // accidentalmente C:\Users\juand en la raíz observada por Turbopack.
  turbopack: { root: process.cwd() },
  // el badge flotante de dev ensucia design/current.png
  devIndicators: false,
  // Permite abrir la app desde la IP de red (VirtualBox host-only, LAN, etc.)
  // ademas de localhost. Sin esto, Next 16 bloquea el bundle cliente y el
  // HMR por cross-origin, la pagina se sirve pero React nunca hidrata.
  allowedDevOrigins: ["192.168.56.1"],
};

export default nextConfig;
