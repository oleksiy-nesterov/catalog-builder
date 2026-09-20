import path from "node:path";

export type PublicationPaths = {
  name: string;
  rootDir: string;
  publicationPath: string;
  pagesDir: string;
  templatesDir: string;
  stylesDir: string;
  fontsDir: string;
  globalAssetsDir: string;
};

export const rootDir = process.cwd();
export const srcDir = path.join(rootDir, "src");
export const publicationsDir = path.join(rootDir, "publications");
export const distDir = path.join(rootDir, "dist");

export const createPublicationPaths = (publicationName: string): PublicationPaths => {
  const publicationRoot = path.join(publicationsDir, publicationName);

  return {
    name: publicationName,
    rootDir: publicationRoot,
    publicationPath: path.join(publicationRoot, "publication.json"),
    pagesDir: path.join(publicationRoot, "pages"),
    templatesDir: path.join(publicationRoot, "templates"),
    stylesDir: path.join(publicationRoot, "styles"),
    fontsDir: path.join(publicationRoot, "fonts"),
    globalAssetsDir: path.join(publicationRoot, "assets")
  };
};
