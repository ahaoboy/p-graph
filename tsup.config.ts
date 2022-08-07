import { defineConfig } from "tsup";
import type { Options } from "tsup";
const isProd = process.env.NODE_ENV === "production"
export default defineConfig((options) => {
  const common: Options = {
    minify: !options.watch,
    splitting: false,
    sourcemap: true,
    bundle: true,
    clean: true,
    format: ["cjs", "esm"],
    external: [],
    noExternal: [],
    platform: "browser",
    dts: !isProd,
  };

  return [{ ...common, entry: ["./src/index.ts"], outDir: "./dist" }];
});
