import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent duplicate React instances that cause blank screens
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  esbuild: {
    // `console.error` y `console.warn` se conservan a propósito: son hoy la
    // única traza de diagnóstico en producción (130 de las 137 llamadas a
    // console del proyecto). Solo se eliminan las de depuración.
    pure: mode === "development"
      ? []
      : ["console.log", "console.debug", "console.trace", "console.info"],
    drop: mode === "development" ? [] : ["debugger"],
  },
  build: {
    rollupOptions: {
      output: {
        // Solo se fuerzan los vendors estables, para que no se invaliden en
        // cada despliegue. El reparto del código de producto se deja a Rollup,
        // que ya agrupa por punto de entrada dinámico (una ruta, un chunk).
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return "vendor-react";
          }
          if (id.includes("node_modules/@supabase/")) return "vendor-supabase";
          if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
          return undefined;
        },
      },
    },
  },
}));
