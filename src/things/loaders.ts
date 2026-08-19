import type { ComponentType } from "react";
import { things } from "./registry";

/**
 * Every built thing, named explicitly.
 *
 * This was a single `import(\`../things/${id}/index\`)` for a while, which
 * is tidier to look at and quietly wrong: the bundler resolves that into a
 * fixed set of modules at build time, so anything added afterwards is
 * missing at runtime with nothing to warn you. Listing them means a typo
 * or a missing folder is a build error instead.
 *
 * Each entry stays a separate chunk, fetched only when the thing opens.
 */
export const loaders: Record<string, () => Promise<{ default: ComponentType }>> = {
  "001": () => import("./001"),
  "002": () => import("./002"),
  "003": () => import("./003"),
  "004": () => import("./004"),
  "005": () => import("./005"),
  "006": () => import("./006"),
  "007": () => import("./007"),
  "008": () => import("./008"),
  "009": () => import("./009"),
  "010": () => import("./010"),
  "011": () => import("./011"),
  "012": () => import("./012"),
  "013": () => import("./013"),
  "014": () => import("./014"),
  "015": () => import("./015"),
};

if (process.env.NODE_ENV !== "production") {
  // The registry and this file have to agree, or a thing looks built in
  // the archive and then renders nothing.
  const orphans = things.filter((t) => t.status === "complete" && !loaders[t.id]);
  if (orphans.length) {
    console.error(
      `things marked complete with no loader: ${orphans.map((t) => t.id).join(", ")}`,
    );
  }
}
