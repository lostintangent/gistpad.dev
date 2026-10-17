/// <reference types="bun" />

import tailwind from "bun-plugin-tailwind";
import { cp, rm } from "node:fs/promises";
import { basename } from "node:path";

// Builds GistPad as a static site in `dist/`, whose code is split into (content-hashed) chunks.
// That way, the app's heavy features (e.g. diagrams, whiteboards and AI) are only downloaded
// when they're used, rather than every time the app loads.

const outdir = "dist";
await rm(outdir, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["index.html"],
  outdir,
  target: "browser",
  splitting: true,
  minify: true,
  reactCompiler: true,
  metafile: true,
  plugins: [tailwind],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    // Local GitHub-token sessions are a dev server affordance (see `.env`),
    // so make sure a developer's token can never end up in a deployed build.
    "process.env.BUN_PUBLIC_GITHUB_TOKEN": "undefined",
  },
  throw: false,
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// The PWA manifest refers to the app's icon by its (unhashed) URL
await cp("src/assets/icon.png", `${outdir}/icon.png`);

// Pages are lazy-loaded, but which page is being opened (the editor, or a shared gist) is known as
// soon as index.html loads, from the URL's hash. So index.html starts downloading the page's code
// alongside the app's startup code, rather than waiting until that runs to discover it.
const outputs = new Map(
  Object.entries(result.metafile!.outputs).map(([path, output]) => [basename(path), output]),
);

/** The chunks that a page (i.e. its lazy-loaded component) needs, beyond the app's startup code. */
function getPageChunks(page: string, startupHtml: string) {
  const chunks = new Set<string>();
  const visit = (file: string) => {
    if (chunks.has(file)) return;
    chunks.add(file);
    for (const { path, kind } of outputs.get(file)!.imports) {
      if (kind === "import-statement") visit(basename(path));
    }
  };

  const [pageChunk] = [...outputs].find(([, { inputs }]) =>
    Object.keys(inputs).some((input) => input.endsWith(page)),
  )!;
  visit(pageChunk);

  return [...chunks].filter((file) => !startupHtml.includes(file));
}

const html = await Bun.file(`${outdir}/index.html`).text();
const editorChunks = getPageChunks("src/features/editor/EditorPage.tsx", html);
const shareChunks = getPageChunks("src/features/share/SharePage.tsx", html);
const preloadPage = `for (const href of location.hash.startsWith("#/share/") ? ${JSON.stringify(shareChunks)} : ${JSON.stringify(editorChunks)}) document.head.append(Object.assign(document.createElement("link"), { rel: "modulepreload", href }));`;
await Bun.write(
  `${outdir}/index.html`,
  html.replace("</head>", `<script>${preloadPage}</script></head>`),
);

// The files that the app downloads when it opens the editor (i.e. the files that index.html loads)
const startupFiles = [
  ...html.matchAll(
    /<(?:script|link rel="(?:stylesheet|modulepreload)")[^>]*(?:src|href)="\.\/([^"]+)"/g,
  ),
].map(([, file]) => file);
const editorFiles = [...startupFiles, ...editorChunks];

// A service worker caches the app's files, so that it loads instantly (and works offline) on return
// visits. It's given the files in this version of the app (so it can remove previous versions'), and
// the files to cache up front (i.e. the page, and what it needs to open the editor).
const serviceWorker = await Bun.build({
  entrypoints: ["src/service-worker.ts"],
  outdir,
  naming: "sw.js",
  target: "browser",
  minify: true,
  define: {
    BUILD_FILES: JSON.stringify(["./", "icon.png", ...outputs.keys()]),
    STARTUP_FILES: JSON.stringify(["./", ...editorFiles]),
  },
  throw: false,
});

if (!serviceWorker.success) {
  for (const log of serviceWorker.logs) console.error(log);
  process.exit(1);
}

const gzippedSize = async (files: string[]) => {
  let bytes = 0;
  for (const file of files)
    bytes += Bun.gzipSync(await Bun.file(`${outdir}/${file}`).bytes()).length;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

console.log(
  `Built ${outdir}/ (${outputs.size} files, ${await gzippedSize([...outputs.keys()])} gzipped), which loads ${await gzippedSize(editorFiles)} (gzipped) to open the editor`,
);
