import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  Object.assign(process.env, loadEnv(mode, repoRoot, ""));

  return {
    envDir: repoRoot,
    plugins: [tailwindcss(), reactRouter()],
    resolve: {
      tsconfigPaths: true,
    },
  };
});
