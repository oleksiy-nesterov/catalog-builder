import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import fs from "fs-extra";
import { CatalogApi } from "./catalogApi";
import { createCatalogPaths, distDir } from "../paths";
import { RenderApi } from "./renderApi";
import type { AssetCopy } from "../resolvers/assetResolver";
import type { BuildTarget, PaperSize } from "../types";

type VivliostyleOutputConfig = {
  path: string;
  format: "pdf";
};

type ImageReplacementConfig = {
  source: string;
  replacement: string;
};

type CmykColor = {
  c: number;
  m: number;
  y: number;
  k: number;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type VivliostyleConfig = {
  title: string;
  size: PaperSize;
  entryContext: string;
  entry: string[];
  output: VivliostyleOutputConfig[];
  pdfPostprocess?: {
    cmyk: {
      ifUnmappedColorsFound: "warn";
      reserveMap: [RgbColor | string, CmykColor][];
    };
    replaceImage?: ImageReplacementConfig[];
    preflight?: "press-ready-local";
  };
};

export class BuildApi {
  private static toPosix(filePath: string): string {
    return filePath.split(path.sep).join(path.posix.sep);
  }

  private static hasCommand(command: string): boolean {
    const lookup = process.platform === "win32" ? "where" : "which";
    const result = spawnSync(lookup, [command], { stdio: "ignore" });
    return result.status === 0;
  }

  private static hasGhostscript(): boolean {
    return BuildApi.hasCommand("gs") || BuildApi.hasCommand("gswin64c") || BuildApi.hasCommand("gswin32c");
  }

  private static hasPdfFonts(): boolean {
    return BuildApi.hasCommand("pdffonts");
  }

  private static hasPressReadyTools(): boolean {
    return BuildApi.hasGhostscript() && BuildApi.hasPdfFonts();
  }

  private static createVivliostyleEnv(enablePreflight: boolean): NodeJS.ProcessEnv {
    if (!enablePreflight) {
      return process.env;
    }

    const allowTempRead = `--permit-file-read=${BuildApi.toPosix(os.tmpdir())}/`;
    const currentOptions = process.env.GS_OPTIONS?.trim();

    return {
      ...process.env,
      GS_OPTIONS: currentOptions ? `${currentOptions} ${allowTempRead}` : allowTempRead
    };
  }

  private static async writeHtml(filePath: string, html: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, html, "utf8");
  }

  private static async copyAssets(outputRoot: string, copies: AssetCopy[]): Promise<void> {
    for (const copy of copies) {
      await fs.copy(copy.source, path.join(outputRoot, "assets", copy.outputRelativePath));
    }
  }

  private static async copyGlobalAssets(sourceDir: string, outputRoot: string): Promise<void> {
    if (await fs.pathExists(sourceDir)) {
      await fs.copy(sourceDir, path.join(outputRoot, "assets", "global"));
    }
  }

  private static async copyFonts(sourceDir: string, outputRoot: string): Promise<void> {
    if (await fs.pathExists(sourceDir)) {
      await fs.copy(sourceDir, path.join(outputRoot, "fonts"));
    }
  }

  private static async cleanupDir(dir: string): Promise<void> {
    await fs.remove(dir);

    const parentDir = path.dirname(dir);
    if ((await fs.pathExists(parentDir)) && (await fs.readdir(parentDir)).length === 0) {
      await fs.remove(parentDir);
    }
  }

  private static async runVivliostyle(inputHtml: string, outputPdf: string, enablePreflight: boolean, configPath?: string): Promise<void> {
    const cli = path.join(process.cwd(), "node_modules", ".bin", "vivliostyle");
    const args = configPath ? ["build", "--config", configPath] : ["build", inputHtml, "-o", outputPdf];
    const env = BuildApi.createVivliostyleEnv(enablePreflight);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(cli, args, { env, stdio: "inherit" });

      child.on("error", reject);
      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Vivliostyle exited with code ${code}`));
      });
    });
  }

  private static createVivliostyleConfig(
    title: string,
    paperSize: PaperSize,
    outputDir: string,
    inputHtml: string,
    outputPdf: string,
    target: BuildTarget,
    replaceImage: ImageReplacementConfig[],
    enablePreflight: boolean
  ): VivliostyleConfig {
    const relativeEntryContext = path.relative(process.cwd(), outputDir);
    const relativeOutput = path.relative(process.cwd(), outputPdf);
    const config: VivliostyleConfig = {
      title,
      size: paperSize,
      entryContext: BuildApi.toPosix(relativeEntryContext),
      entry: [BuildApi.toPosix(path.basename(inputHtml))],
      output: [
        {
          path: BuildApi.toPosix(relativeOutput),
          format: "pdf"
        }
      ]
    };

    if (target === "print") {
      config.pdfPostprocess = {
        cmyk: {
          ifUnmappedColorsFound: "warn",
          reserveMap: [
            ["#000000", { c: 0, m: 0, y: 0, k: 10000 }],
            ["#ffffff", { c: 0, m: 0, y: 0, k: 0 }],
          ]
        },
        ...(replaceImage.length > 0 ? { replaceImage } : {}),
        ...(enablePreflight ? { preflight: "press-ready-local" } : {})
      };
    }

    return config;
  }

  private static async writeVivliostyleConfig(
    title: string,
    paperSize: PaperSize,
    outputDir: string,
    inputHtml: string,
    outputPdf: string,
    printReplacements: { from: string; to: string }[],
    target: BuildTarget,
    enablePreflight: boolean
  ): Promise<string> {
    const configPath = path.join(outputDir, "vivliostyle.config.mjs");
    const replaceImage = printReplacements.map((replacement) => ({
      source: replacement.from,
      replacement: replacement.to
    }));
    const config = BuildApi.createVivliostyleConfig(title, paperSize, outputDir, inputHtml, outputPdf, target, replaceImage, enablePreflight);

    await fs.writeFile(configPath, `export default ${JSON.stringify(config, null, 2)};\n`, "utf8");
    await fs.writeJson(path.join(outputDir, "print-image-replacements.json"), replaceImage, { spaces: 2 });

    return configPath;
  }

  static async build(target: BuildTarget, catalogName = "default"): Promise<void> {
    const paths = createCatalogPaths(catalogName);
    const loaded = await CatalogApi.load(paths);
    const catalogOutputRoot = path.join(distDir, catalogName);

    if (target === "web") {
      const outputDir = path.join(catalogOutputRoot, "web");
      await fs.emptyDir(outputDir);
      const rendered = await RenderApi.renderCatalog(paths, loaded, target, "assets");

      for (const page of rendered.pages) {
        const pageHtml = RenderApi.renderDocument(loaded.catalog.title, loaded.catalog.language, rendered.styles, [page]);
        await BuildApi.writeHtml(path.join(outputDir, `${page.id}.html`), pageHtml);
      }

      await BuildApi.writeHtml(path.join(outputDir, "index.html"), rendered.documentHtml);
      await BuildApi.copyGlobalAssets(paths.globalAssetsDir, outputDir);
      await BuildApi.copyFonts(paths.fontsDir, outputDir);
      await BuildApi.copyAssets(outputDir, rendered.assetCopies);
      console.log(`Built web catalog: ${path.relative(process.cwd(), outputDir)}`);
      return;
    }

    const outputDir = path.join(catalogOutputRoot, target);
    const tempDir = path.join(catalogOutputRoot, ".tmp", target);
    await fs.emptyDir(outputDir);
    await fs.emptyDir(tempDir);

    const rendered = await RenderApi.renderCatalog(paths, loaded, target, "assets");
    const inputHtml = path.join(tempDir, "catalog.html");
    await BuildApi.writeHtml(inputHtml, rendered.documentHtml);
    await BuildApi.copyGlobalAssets(paths.globalAssetsDir, tempDir);
    await BuildApi.copyFonts(paths.fontsDir, tempDir);
    await BuildApi.copyAssets(tempDir, rendered.assetCopies);

    const outputPdf = path.join(outputDir, target === "pdf" ? "catalog-web.pdf" : "catalog-print.pdf");
    const enablePreflight = target === "print" && BuildApi.hasPressReadyTools();
    const configPath = await BuildApi.writeVivliostyleConfig(
      loaded.catalog.title,
      loaded.catalog.paperSize,
      tempDir,
      inputHtml,
      outputPdf,
      rendered.replacements,
      target,
      enablePreflight
    );

    if (target === "print" && !enablePreflight) {
      console.warn("Ghostscript (gs) or pdffonts was not found; building print PDF without press-ready preflight.");
    }

    await BuildApi.runVivliostyle(inputHtml, outputPdf, enablePreflight, configPath);
    await BuildApi.cleanupDir(tempDir);
    console.log(`Built ${target} catalog: ${path.relative(process.cwd(), outputPdf)}`);
  }
}
