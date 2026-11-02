import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Una pantalla ya visitada se vuelve a mostrar al instante durante 30 s, sin otro
    // viaje al servidor (por defecto, 0: cada vuelta la pedía de nuevo). Las acciones
    // que guardan llaman a revalidatePath o cambian cookies, y eso vacía este caché.
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
