import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El build se genera en la raíz de evadesopm/ para que Apache lo sirva
// en http://localhost/evadesopm/ . base './' hace las rutas relativas.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5174, host: true },
  build: {
    outDir: '..',          // = C:\xampp\htdocs\evadesopm
    emptyOutDir: false,    // NO borrar backend/ database/ frontend/ OPM/
  },
})
