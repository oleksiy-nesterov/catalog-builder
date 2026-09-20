import type { BuildTarget } from "./types";
import { BuildApi } from "./api/buildApi";

const target = process.argv[2] as BuildTarget | "all" | undefined;
const publicationName = process.argv[3];

if (!target || !["web", "pdf", "print", "all"].includes(target) || !publicationName) {
  console.error("Usage: tsx src/index.ts <web|pdf|print|all> <publication-name>");
  process.exit(1);
}

try {
  if (target === "all") {
    await BuildApi.build("web", publicationName);
    await BuildApi.build("pdf", publicationName);
    await BuildApi.build("print", publicationName);
  } else {
    await BuildApi.build(target, publicationName);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
