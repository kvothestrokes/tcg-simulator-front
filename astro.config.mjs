// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Salida estática: todo el estado viene del cliente (Supabase Auth + el
// servicio de tiempo real), así que no hace falta servidor ni adaptador.
// Despliega igual en Vercel, Netlify o cualquier hosting de estáticos.
//
// Por eso la sala vive en /room/?code=ABC123 en vez de /room/ABC123: una ruta
// dinámica exigiría SSR. Si prefieres la URL bonita, instala @astrojs/vercel,
// pon output: 'server' y renombra la página a src/pages/room/[code].astro.
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
