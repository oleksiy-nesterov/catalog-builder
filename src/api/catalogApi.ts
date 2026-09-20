import path from "node:path";
import fs from "fs-extra";
import type { CatalogPaths } from "../paths";
import type { Catalog, PageMeta, PageRepeat, PaperSize } from "../types";

const paperSizes = [
  "A0",
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "A6",
  "B0",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "Letter",
  "Legal",
  "Ledger"
] as const satisfies readonly PaperSize[];

export type LoadedPage = {
  meta: PageMeta;
  blank: boolean;
  dir?: string;
  templatePath?: string;
};

export type LoadedCatalog = {
  catalog: Catalog;
  pages: LoadedPage[];
};

type ExpandedPage = {
  id: string;
  repeat: PageRepeat;
};

type ValidatedCatalog = Catalog & {
  expandedPages: ExpandedPage[];
};

export class CatalogApi {
  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private static requireString(source: Record<string, unknown>, key: string, label: string): string {
    const value = source[key];

    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${label}: "${key}" must be a non-empty string`);
    }

    return value;
  }

  private static requirePaperSize(source: Record<string, unknown>, key: string, label: string): PaperSize {
    const value = CatalogApi.requireString(source, key, label);

    if (!paperSizes.includes(value as PaperSize)) {
      throw new Error(`${label}: "${key}" must be one of ${paperSizes.join(", ")}`);
    }

    return value as PaperSize;
  }

  private static requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (!CatalogApi.isRecord(value)) {
      throw new Error(`${label} must be an object`);
    }

    return value;
  }

  private static requirePositiveInteger(source: Record<string, unknown>, key: string, label: string): number {
    const value = source[key];

    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      throw new Error(`${label}: "${key}" must be a positive integer`);
    }

    return value;
  }

  private static expandPage(value: unknown, label: string): ExpandedPage[] {
    if (typeof value === "string") {
      return [
        {
          id: value,
          repeat: {
            index: 0,
            count: 1
          }
        }
      ];
    }

    const record = CatalogApi.requireRecord(value, label);
    const id = CatalogApi.requireString(record, "name", label);
    const count = CatalogApi.requirePositiveInteger(record, "repeat", label);

    return Array.from({ length: count }, (_, index) => ({
      id,
      repeat: {
        index,
        count
      }
    }));
  }

  private static expandPages(values: unknown[], label: string): ExpandedPage[] {
    return values.flatMap((page, index) => CatalogApi.expandPage(page, `${label}: Page ${index}`));
  }

  private static validateCatalog(value: unknown, label: string): ValidatedCatalog {
    const record = CatalogApi.requireRecord(value, label);
    const pages = record.pages;

    if (!Array.isArray(pages) || pages.length === 0) {
      throw new Error(`${label}: "pages" must be a non-empty array of page ids, repeat page objects, or empty page placeholders`);
    }

    const expandedPages = CatalogApi.expandPages(pages, `${label}: "pages"`);

    return {
      title: CatalogApi.requireString(record, "title", label),
      language: CatalogApi.requireString(record, "language", label),
      edition: CatalogApi.requireString(record, "edition", label),
      paperSize: CatalogApi.requirePaperSize(record, "paperSize", label),
      pages: expandedPages.map((page) => page.id),
      expandedPages
    };
  }

  private static async readJson(filePath: string, label: string): Promise<unknown> {
    if (!(await fs.pathExists(filePath))) {
      throw new Error(`${label} does not exist: ${filePath}`);
    }

    try {
      return await fs.readJson(filePath);
    } catch (error) {
      throw new Error(`${label} is not valid JSON: ${(error as Error).message}`);
    }
  }

  static async load(paths: CatalogPaths): Promise<LoadedCatalog> {
    const catalogLabel = `catalogs/${paths.name}/catalog.json`;
    const catalog = CatalogApi.validateCatalog(await CatalogApi.readJson(paths.catalogPath, catalogLabel), catalogLabel);

    const pages: LoadedPage[] = [];

    for (const [index, page] of catalog.expandedPages.entries()) {
      const id = page.id;
      const blank = id.length === 0;
      const side = index % 2 === 0 ? "right" : "left";

      if (blank) {
        pages.push({
          meta: {
            id: `blank-page-${index}`,
            index,
            side,
            className: `page page-${index} blank-page`,
            repeat: page.repeat
          },
          blank
        });
        continue;
      }

      const pageDir = path.join(paths.pagesDir, id);
      const templatePath = path.join(pageDir, "index.html");

      if (!(await fs.pathExists(pageDir))) {
        throw new Error(`Page "${id}": folder does not exist`);
      }

      if (!(await fs.pathExists(templatePath))) {
        throw new Error(`Page "${id}": index.html does not exist`);
      }

      pages.push({
        meta: {
          id,
          index,
          side,
          className: `page page-${index} page-${side} ${id}`,
          repeat: page.repeat
        },
        blank,
        dir: pageDir,
        templatePath: `${id}/index.html`
      });
    }

    return { catalog, pages };
  }
}
