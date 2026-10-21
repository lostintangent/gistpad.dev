import { resolve } from "node:path";
import { defineConfig, type HotUpdateOptions } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(async () => {
  // The hash/auth/layout hint is application state, so it must run before the static shell paints.
  const prepaintScript = await Bun.build({
    entrypoints: ["src/shell/prepaint/script.ts"],
    format: "iife",
    minify: true,
    metafile: true,
  });
  const prepaintFiles = new Set(
    Object.keys(prepaintScript.metafile!.inputs).map((file) => resolve(file)),
  );

  return {
    resolve: { tsconfigPaths: true },
    define: {
      __PREPAINT_SCRIPT__: JSON.stringify(await prepaintScript.outputs[0]!.text()),
    },
    worker: { rolldownOptions: { output: { entryFileNames: "sw.js" } } },
    plugins: [
      tailwindcss(),
      tanstackStart({
        router: {
          entry: "shell/router/router.tsx",
          routesDirectory: ".",
          generatedRouteTree: "shell/router/routeTree.gen.ts",
          virtualRouteConfig: "./src/shell/router/routes.ts",
          // Pages already split at the shared lazy imports; route wrappers need no extra chunks.
          codeSplittingOptions: { defaultBehavior: [] },
        },
        spa: { prerender: { outputPath: "/index.html" } },
      }),
      react({ compiler: true }),
      {
        name: "gistpad:prepaint",
        apply: "serve",
        async hotUpdate({ file, server }: HotUpdateOptions) {
          if (prepaintFiles.has(file)) await server.restart();
        },
      },
    ],
  };
});
