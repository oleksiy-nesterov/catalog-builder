import path from "node:path";
import fs from "fs-extra";
import MarkdownIt from "markdown-it";
import { parse } from "csv-parse/sync";
const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true });

export type FileHelper = ((relativePath: string) => unknown) & {
  md: (relativePath: string) => string;
  csv: (relativePath: string) => Record<string, string>[];
  json: (relativePath: string) => unknown;
  text: (relativePath: string) => string;
  asset: (relativePath: string) => string;
};

type FileApiOptions = {
  ownerLabel: string;
  ownerDir: string;
  resolveAsset: (relativePath: string) => string;
};

const assetExtensions = new Set([
  ".avif",
  ".gif",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
  ".woff",
  ".woff2"
]);

export class FileApi {
  private static renderMarkdown(content: string): string {
    return markdown.render(content);
  }

  private static parseCsv(content: string): Record<string, string>[] {
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  }

  private static requireFile(options: FileApiOptions, relativePath: string): string {
    const fullPath = path.join(options.ownerDir, relativePath);

    if (!fs.pathExistsSync(fullPath)) {
      throw new Error(`${options.ownerLabel}: File "${relativePath}" does not exist`);
    }

    return fullPath;
  }

  static create(options: FileApiOptions): FileHelper {
    const read = (relativePath: string): string => {
      const fullPath = FileApi.requireFile(options, relativePath);
      return fs.readFileSync(fullPath, "utf8");
    };

    const asset = options.resolveAsset;

    const file = ((relativePath: string): unknown => {
      const extension = path.extname(relativePath).toLowerCase();

      if (extension === ".md") {
        return FileApi.renderMarkdown(read(relativePath));
      }

      if (extension === ".csv") {
        return FileApi.parseCsv(read(relativePath));
      }

      if (extension === ".json") {
        return JSON.parse(read(relativePath)) as unknown;
      }

      if (assetExtensions.has(extension) || relativePath.startsWith("assets/")) {
        return asset(relativePath);
      }

      return read(relativePath);
    }) as FileHelper;

    file.md = (relativePath: string): string => FileApi.renderMarkdown(read(relativePath));
    file.csv = (relativePath: string): Record<string, string>[] => FileApi.parseCsv(read(relativePath));
    file.json = (relativePath: string): unknown => JSON.parse(read(relativePath)) as unknown;
    file.text = read;
    file.asset = asset;

    return file;
  }
}
