import { AssetResolver, type AssetCopy } from "../resolvers/assetResolver";
import type { LoadedPublication } from "./publicationApi";
import { CssResolver } from "../resolvers/cssResolver";
import type { PublicationPaths } from "../paths";
import { TemplateApi } from "./templateApi";
import type { BuildTarget, PageMeta } from "../types";

export type RenderedPage = {
  id: string;
  html: string;
};

export type RenderResult = {
  pages: RenderedPage[];
  styles: string;
  documentHtml: string;
  assetCopies: AssetCopy[];
  replacements: { from: string; to: string }[];
};

type RenderedPageMeta = PageMeta & {
  target: BuildTarget;
};

export class RenderApi {
  private static escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  }

  private static wrapPage(className: string, content: string): string {
    return `<section class="${RenderApi.escapeHtml(className)}">${content}</section>`;
  }

  private static createPageMeta(page: PageMeta, target: BuildTarget): RenderedPageMeta {
    return {
      ...page,
      target
    };
  }

  static renderDocument(title: string, language: string, styles: string, pages: RenderedPage[]): string {
    return `<!doctype html>
<html lang="${RenderApi.escapeHtml(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${RenderApi.escapeHtml(title)}</title>
  <style>${styles}</style>
</head>
<body>
${pages.map((page) => page.html).join("\n")}
</body>
</html>`;
  }

  static async renderPublication(paths: PublicationPaths, loaded: LoadedPublication, target: BuildTarget, assetPrefix: string): Promise<RenderResult> {
    const assetResolver = new AssetResolver(paths, target, assetPrefix);
    const env = TemplateApi.createEnvironment(paths, assetResolver);
    const pageTemplatePaths = loaded.pages.flatMap((page) => page.templatePath ? [page.templatePath] : []);
    const templateClosure = await TemplateApi.collectTemplateClosure(paths, pageTemplatePaths);
    const pages: RenderedPage[] = [];

    for (const page of loaded.pages) {
      const pageMeta = RenderApi.createPageMeta(page.meta, target);

      if (page.blank) {
        if (target === "print") {
          pages.push({ id: pageMeta.id, html: RenderApi.wrapPage(pageMeta.className, "") });
        }

        continue;
      }

      if (!page.templatePath) {
        throw new Error(`Page "${page.meta.id}": template path is missing`);
      }

      const template = await TemplateApi.resolve(paths, page.templatePath);
      const global = {
        asset: (relativePath: string) => assetResolver.resolveGlobalAsset(relativePath)
      };

      const context = {
        target,
        publication: loaded.publication,
        page: pageMeta,
        global
      };

      const content = await TemplateApi.render(env, template, context);
      const html = RenderApi.wrapPage(pageMeta.className, content);
      pages.push({ id: pageMeta.id, html });
    }

    const styles = await CssResolver.collectStyles(paths, templateClosure, target);
    const documentHtml = RenderApi.renderDocument(loaded.publication.title, loaded.publication.language, styles, pages);

    return {
      pages,
      styles,
      documentHtml,
      assetCopies: assetResolver.getCopies(),
      replacements: assetResolver.getReplacements()
    };
  }
}
