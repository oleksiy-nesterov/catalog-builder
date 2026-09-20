import path from "node:path";
import fs from "fs-extra";
import nunjucks from "nunjucks";
import { AssetResolver } from "../resolvers/assetResolver";
import { FileApi, type FileHelper } from "./fileApi";
import type { PublicationPaths } from "../paths";

const includePattern = /{%\s*include\s+["']([^"']+)["']/g;
const templateCallPattern = /\btemplate\(\s*["']([^"']+)["']/g;

export type TemplateSource = {
  id: string;
  path: string;
  dir: string;
  templatePath: string;
  rootClasses: string[];
  type: "page" | "template";
};

class LocalFileLoader extends nunjucks.FileSystemLoader {
  getSource(name: string): nunjucks.LoaderSource {
    const source = super.getSource(name);
    const fileApiPath = JSON.stringify(source.path);

    return {
      ...source,
      src: `{% set file = __fileApi(${fileApiPath}) %}\n${source.src}`
    };
  }
}

export class TemplateApi {
  private static createTemplateContext(parentContext: Record<string, unknown>, params: unknown): Record<string, unknown> {
    if (params === undefined) {
      return parentContext;
    }

    if (typeof params !== "object" || params === null || Array.isArray(params)) {
      throw new Error("template(name, params): params must be an object");
    }

    return {
      ...parentContext,
      ...(params as Record<string, unknown>)
    };
  }

  private static createFileApi(template: TemplateSource, assetResolver: AssetResolver): FileHelper {
    return FileApi.create({
      ownerLabel: `${template.type === "page" ? "Page" : "Template"} "${template.id}"`,
      ownerDir: template.dir,
      resolveAsset: (relativePath: string) =>
        template.type === "page"
          ? assetResolver.resolvePageAsset(template.id, template.dir, relativePath)
          : assetResolver.resolveTemplateAsset(template.id, template.dir, relativePath)
    });
  }

  private static normalizeTemplatePath(templateName: string): string {
    return templateName.endsWith(".html") ? templateName : `${templateName}/index.html`;
  }

  private static renderTemplate(env: nunjucks.Environment, templatePath: string, context: object): Promise<string> {
    return new Promise((resolve, reject) => {
      env.render(templatePath, context, (error, result) => {
        if (error || !result) {
          reject(error ?? new Error(`Template "${templatePath}" rendered no output`));
          return;
        }

        resolve(result);
      });
    });
  }

  private static renderTemplateSync(env: nunjucks.Environment, templatePath: string, context: object): string {
    return env.render(templatePath, context);
  }

  private static wrapTemplate(templateId: string, content: string): string {
    return `<div class="${templateId}">${content}</div>`;
  }

  private static async getTemplateIncludes(paths: PublicationPaths, templatePath: string): Promise<string[]> {
    const source = await TemplateApi.resolve(paths, templatePath);
    const content = await fs.readFile(source.path, "utf8");
    const includes = [...content.matchAll(includePattern)].map((match) => match[1]);
    const templateCalls = [...content.matchAll(templateCallPattern)].map((match) => TemplateApi.normalizeTemplatePath(match[1]));

    return [...new Set([...includes, ...templateCalls])];
  }

  private static async visitTemplate(paths: PublicationPaths, templatePath: string, stack: string[], ordered: Map<string, TemplateSource>): Promise<void> {
    if (stack.includes(templatePath)) {
      throw new Error(`Recursive template include detected: ${[...stack, templatePath].join(" -> ")}`);
    }

    if (ordered.has(templatePath)) {
      return;
    }

    const source = await TemplateApi.resolve(paths, templatePath);
    ordered.set(templatePath, source);

    for (const includedTemplate of await TemplateApi.getTemplateIncludes(paths, templatePath)) {
      await TemplateApi.visitTemplate(paths, includedTemplate, [...stack, templatePath], ordered);
    }
  }

  static createEnvironment(paths: PublicationPaths, assetResolver: AssetResolver): nunjucks.Environment {
    const env = new nunjucks.Environment(new LocalFileLoader([paths.pagesDir, paths.templatesDir], { noCache: true }), {
      autoescape: false,
      throwOnUndefined: true
    });

    env.addGlobal("__fileApi", (templateFilePath: string) => TemplateApi.createFileApi(TemplateApi.resolveSyncByFilePath(paths, templateFilePath), assetResolver));
    env.addGlobal("template", function (this: { ctx?: Record<string, unknown> }, templateName: string, params?: unknown) {
      const templatePath = TemplateApi.normalizeTemplatePath(templateName);
      const source = TemplateApi.resolveSync(paths, templatePath);
      const context = TemplateApi.createTemplateContext(this.ctx ?? {}, params);
      const content = TemplateApi.renderTemplateSync(env, source.templatePath, context);

      return TemplateApi.wrapTemplate(source.id, content);
    });

    return env;
  }

  static resolveSync(paths: PublicationPaths, templatePath: string): TemplateSource {
    const pageTemplatePath = path.join(paths.pagesDir, templatePath);
    const sharedTemplatePath = path.join(paths.templatesDir, templatePath);

    if (fs.pathExistsSync(pageTemplatePath)) {
      return TemplateApi.resolveSyncByFilePath(paths, pageTemplatePath);
    }

    if (fs.pathExistsSync(sharedTemplatePath)) {
      return TemplateApi.resolveSyncByFilePath(paths, sharedTemplatePath);
    }

    throw new Error(`Template "${templatePath}" does not exist`);
  }

  static async resolve(paths: PublicationPaths, templatePath: string): Promise<TemplateSource> {
    const pageTemplatePath = path.join(paths.pagesDir, templatePath);
    const sharedTemplatePath = path.join(paths.templatesDir, templatePath);

    if (await fs.pathExists(pageTemplatePath)) {
      return TemplateApi.resolveSyncByFilePath(paths, pageTemplatePath);
    }

    if (await fs.pathExists(sharedTemplatePath)) {
      return TemplateApi.resolveSyncByFilePath(paths, sharedTemplatePath);
    }

    throw new Error(`Template "${templatePath}" does not exist`);
  }

  static resolveSyncByFilePath(paths: PublicationPaths, templateFilePath: string): TemplateSource {
    const relativePagePath = path.relative(paths.pagesDir, templateFilePath);
    const isPageTemplate = relativePagePath !== "" && !relativePagePath.startsWith("..") && !path.isAbsolute(relativePagePath);
    const rootDir = isPageTemplate ? paths.pagesDir : paths.templatesDir;
    const relativePath = path.relative(rootDir, templateFilePath);
    const id = relativePath.split(path.sep)[0];

    return {
      id,
      path: templateFilePath,
      dir: path.dirname(templateFilePath),
      templatePath: relativePath.split(path.sep).join(path.posix.sep),
      rootClasses: isPageTemplate ? [id, "page"] : [id],
      type: isPageTemplate ? "page" : "template"
    };
  }

  static async collectTemplateClosure(paths: PublicationPaths, templatePaths: string[]): Promise<TemplateSource[]> {
    const ordered = new Map<string, TemplateSource>();

    for (const templatePath of templatePaths) {
      await TemplateApi.visitTemplate(paths, templatePath, [], ordered);
    }

    return [...ordered.values()];
  }

  static async render(env: nunjucks.Environment, template: TemplateSource, context: object): Promise<string> {
    return TemplateApi.renderTemplate(env, template.templatePath, context);
  }
}
