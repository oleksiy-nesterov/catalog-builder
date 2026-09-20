import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { CatalogApi } from "./catalogApi";
import { catalogsDir, createCatalogPaths } from "../paths";
import { RenderApi, type RenderResult } from "./renderApi";

type DevRender = {
  rendered: RenderResult;
  title: string;
  language: string;
};

const contentTypes: Record<string, string> = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export class DevApi {
  private static async render(catalogName: string): Promise<DevRender> {
    const paths = createCatalogPaths(catalogName);
    const loaded = await CatalogApi.load(paths);
    const rendered = await RenderApi.renderCatalog(paths, loaded, "web", "assets");

    return {
      rendered,
      title: loaded.catalog.title,
      language: loaded.catalog.language
    };
  }

  private static async sendHtml(server: ViteDevServer, res: ServerResponse, url: string, html: string): Promise<void> {
    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypes[".html"]);
    res.end(await server.transformIndexHtml(url, html));
  }

  private static sendFile(res: ServerResponse, filePath: string): void {
    const content = fs.readFileSync(filePath);

    res.statusCode = 200;
    res.setHeader("Content-Type", contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Content-Length", content.byteLength);
    res.end(content);
  }

  private static sendText(res: ServerResponse, statusCode: number, message: string): void {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(message);
  }

  private static normalizePageName(value: string | undefined): string | undefined {
    if (!value || value === "index" || value === "index.html") {
      return undefined;
    }

    return value.endsWith(".html") ? value.slice(0, -".html".length) : value;
  }

  private static resolveGlobalAssetPath(catalogName: string, assetPath: string): string | undefined {
    if (!assetPath.startsWith("global/")) {
      return undefined;
    }

    const paths = createCatalogPaths(catalogName);
    const relativePath = assetPath.slice("global/".length);
    const filePath = path.join(paths.globalAssetsDir, relativePath);
    const relativeToAssets = path.relative(paths.globalAssetsDir, filePath);

    if (relativeToAssets.startsWith("..") || path.isAbsolute(relativeToAssets) || !fs.existsSync(filePath)) {
      return undefined;
    }

    return filePath;
  }

  private static resolveFontPath(catalogName: string, fontPath: string): string | undefined {
    const paths = createCatalogPaths(catalogName);
    const filePath = path.join(paths.fontsDir, fontPath);
    const relativeToFonts = path.relative(paths.fontsDir, filePath);

    if (relativeToFonts.startsWith("..") || path.isAbsolute(relativeToFonts) || !fs.existsSync(filePath)) {
      return undefined;
    }

    return filePath;
  }

  private static async handleRequest(server: ViteDevServer, defaultCatalogName: string, req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const catalogName = segments[0] ?? defaultCatalogName;

    if (requestUrl.pathname === "/") {
      res.statusCode = 302;
      res.setHeader("Location", `/${defaultCatalogName}/`);
      res.end();
      return;
    }

    const current = await DevApi.render(catalogName);

    if (segments[1] === "assets") {
      const assetPath = segments.slice(2).join("/");
      const copy = current.rendered.assetCopies.find((item) => item.outputRelativePath === assetPath);
      const globalAssetPath = DevApi.resolveGlobalAssetPath(catalogName, assetPath);

      if (!copy) {
        if (globalAssetPath) {
          DevApi.sendFile(res, globalAssetPath);
          return;
        }

        DevApi.sendText(res, 404, `Asset not found: ${assetPath}`);
        return;
      }

      DevApi.sendFile(res, copy.source);
      return;
    }

    if (segments[1] === "fonts") {
      const fontPath = segments.slice(2).join("/");
      const filePath = DevApi.resolveFontPath(catalogName, fontPath);

      if (!filePath) {
        DevApi.sendText(res, 404, `Font not found: ${fontPath}`);
        return;
      }

      DevApi.sendFile(res, filePath);
      return;
    }

    const pageName = DevApi.normalizePageName(segments[1]);

    if (!pageName) {
      await DevApi.sendHtml(server, res, requestUrl.pathname, current.rendered.documentHtml);
      return;
    }

    const page = current.rendered.pages.find((item) => item.id === pageName);

    if (!page) {
      DevApi.sendText(res, 404, `Page not found: ${catalogName}/${pageName}`);
      return;
    }

    await DevApi.sendHtml(server, res, requestUrl.pathname, RenderApi.renderDocument(current.title, current.language, current.rendered.styles, [page]));
  }

  static async start(defaultCatalogName = "default", port = 5173): Promise<void> {
    const server = await createServer({
      appType: "custom",
      clearScreen: false,
      server: {
        port,
        strictPort: false
      }
    });

    server.watcher.add(catalogsDir);
    server.watcher.on("all", (_event, filePath) => {
      if (filePath.startsWith(catalogsDir)) {
        server.ws.send({ type: "full-reload" });
      }
    });

    server.middlewares.use(async (req, res, next) => {
      try {
        await DevApi.handleRequest(server, defaultCatalogName, req, res);
      } catch (error) {
        if (res.headersSent) {
          next(error);
          return;
        }

        DevApi.sendText(res, 500, (error as Error).stack ?? (error as Error).message);
      }
    });

    await server.listen();
    server.printUrls();
    console.log(`Catalog preview: http://localhost:${server.config.server.port}/${defaultCatalogName}/`);
    console.log(`Page preview: http://localhost:${server.config.server.port}/${defaultCatalogName}/cover-front`);
  }
}

const catalogName = process.argv[2] ?? "default";
const port = process.argv[3] ? Number(process.argv[3]) : 5173;

try {
  await DevApi.start(catalogName, port);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
