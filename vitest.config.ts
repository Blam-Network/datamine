import { join } from "node:path";
import { defineConfig } from "vitest/config";

const src = join(import.meta.dirname, "src").replaceAll("\\", "/");

export default defineConfig({
  resolve: {
    // Public import paths resolve to sources.
    alias: [
      { find: /^@blamnetwork\/datamine$/, replacement: `${src}/index.ts` },
      { find: /^@blamnetwork\/datamine\/(.+)$/, replacement: `${src}/$1.ts` },
    ],
  },
  test: {
    include: ["test/**/*.test.ts"],
    // cstruct's ESM build uses extensionless imports, which Node's ESM loader
    // does not accept.
    server: { deps: { inline: ["@craftycodie/cstruct"] } },
  },
});
