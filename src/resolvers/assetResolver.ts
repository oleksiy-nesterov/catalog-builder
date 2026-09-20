import path from "node:path";
import fs from "fs-extra";
import type { PublicationPaths } from "../paths";
import type { BuildTarget } from "../types";

type AssetScope = "global" | "page" | "template";

export type AssetCopy = {
  source: string;
  outputRelativePath: string;
  originalSource?: string;
};

export class AssetResolver {
  private copies = new Map<string, AssetCopy>();
  private replacements: { from: string; to: string }[] = [];

  constructor(
    private readonly paths: PublicationPaths,
    private readonly target: BuildTarget,
    private readonly outputAssetPrefix: string
  ) {}

  private static resolvePrintAsset(originalPath: string): string {
    const parsed = path.parse(originalPath);
    const tiffPath = path.join(parsed.dir, `${parsed.name}.tiff`);

    if (fs.pathExistsSync(tiffPath)) {
      return tiffPath;
    }

    return originalPath;
  }

  private resolveAsset(scope: AssetScope, ownerId: string, originalPath: string, relativePath: string): string {
    if (!fs.pathExistsSync(originalPath)) {
      const owner = scope === "global" ? "Global asset" : `${scope === "page" ? "Page" : "Template"} "${ownerId}"`;
      throw new Error(`${owner}: asset "${relativePath}" does not exist`);
    }

    const replacementPath = this.target === "print" ? AssetResolver.resolvePrintAsset(originalPath) : originalPath;
    const outputPathParts = scope === "global" ? [scope, relativePath] : [scope, ownerId, relativePath];
    const outputRelativePath = path.posix.join(...outputPathParts.map((part) => part.split(path.sep).join(path.posix.sep)));
    const copyKey = `${originalPath}->${outputRelativePath}`;

    this.copies.set(copyKey, {
      source: originalPath,
      outputRelativePath,
      originalSource: replacementPath === originalPath ? undefined : originalPath
    });

    if (replacementPath !== originalPath) {
      this.replacements.push({ from: originalPath, to: replacementPath });
    }

    return path.posix.join(this.outputAssetPrefix, outputRelativePath);
  }

  getCopies(): AssetCopy[] {
    return [...this.copies.values()];
  }

  getReplacements(): { from: string; to: string }[] {
    return this.replacements;
  }

  resolveGlobalAsset(relativePath: string): string {
    const original = path.join(this.paths.globalAssetsDir, relativePath);
    return this.resolveAsset("global", "global", original, relativePath);
  }

  resolvePageAsset(pageId: string, pageDir: string, relativePath: string): string {
    const original = path.join(pageDir, relativePath);
    return this.resolveAsset("page", pageId, original, relativePath);
  }

  resolveTemplateAsset(templateId: string, templateDir: string, relativePath: string): string {
    const original = path.join(templateDir, relativePath);
    return this.resolveAsset("template", templateId, original, relativePath);
  }
}
