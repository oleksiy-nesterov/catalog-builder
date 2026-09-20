import path from "node:path";

export type CatalogPaths = {
  name: string;
  rootDir: string;
  catalogPath: string;
  pagesDir: string;
  templatesDir: string;
  stylesDir: string;
  fontsDir: string;
  globalAssetsDir: string;
};

export const rootDir = process.cwd();
export const srcDir = path.join(rootDir, "src");
export const catalogsDir = path.join(rootDir, "catalogs");
export const distDir = path.join(rootDir, "dist");

export const createCatalogPaths = (catalogName: string): CatalogPaths => {
  const catalogRoot = path.join(catalogsDir, catalogName);

  return {
    name: catalogName,
    rootDir: catalogRoot,
    catalogPath: path.join(catalogRoot, "catalog.json"),
    pagesDir: path.join(catalogRoot, "pages"),
    templatesDir: path.join(catalogRoot, "templates"),
    stylesDir: path.join(catalogRoot, "styles"),
    fontsDir: path.join(catalogRoot, "fonts"),
    globalAssetsDir: path.join(catalogRoot, "assets")
  };
};
