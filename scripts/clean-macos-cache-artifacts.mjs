import { rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = [".next"];

function walk(dir) {
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);

    if (entry === "Icon\r" || entry === "Icon?") {
      rmSync(fullPath, { force: true });
      console.log(`Removed macOS cache artifact: ${fullPath}`);
      continue;
    }

    try {
      if (statSync(fullPath).isDirectory()) walk(fullPath);
    } catch {
      // Ignore files that disappear while walking.
    }
  }
}

for (const root of roots) walk(root);
