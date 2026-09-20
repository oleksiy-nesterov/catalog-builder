import type { BuildTarget } from "./types";
import { BuildApi } from "./api/buildApi";

const target = process.argv[2] as BuildTarget | "all" | undefined;
const catalogName = process.argv[3] ?? "default";

if (!target || !["web", "pdf", "print", "all"].includes(target)) {
  console.error("Usage: tsx src/index.ts <web|pdf|print|all> [catalog-name]");
  process.exit(1);
}

try {
  if (target === "all") {
    await BuildApi.build("web", catalogName);
    await BuildApi.build("pdf", catalogName);
    await BuildApi.build("print", catalogName);
  } else {
    await BuildApi.build(target, catalogName);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
