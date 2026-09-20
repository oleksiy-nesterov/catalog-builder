import path from "node:path";
import fs from "fs-extra";
import type { PublicationPaths } from "../paths";
import type { BuildTarget } from "../types";
import type { TemplateSource } from "../api/templateApi";

const commonStyles = ["reset.css", "variables.css", "typography.css", "base.css"];

export class CssResolver {
  private static getScopeSelector(template: TemplateSource): string {
    return template.type === "page" ? `.${template.id}.page` : `.${template.id}`;
  }

  private static scopeCss(css: string, template: TemplateSource): string {
    return css.replaceAll(":scope", CssResolver.getScopeSelector(template));
  }

  private static async findLocalStyleFile(template: TemplateSource): Promise<string | undefined> {
    const files = [path.join(template.dir, "styles.css"), path.join(template.dir, "style.css")];

    for (const file of files) {
      if (await fs.pathExists(file)) {
        return file;
      }
    }

    return undefined;
  }

  static async collectStyles(paths: PublicationPaths, templates: TemplateSource[], target: BuildTarget): Promise<string> {
    const targetStyle = target === "web" ? "web.css" : "pdf.css";
    const globalFiles = [...commonStyles.map((name) => path.join(paths.stylesDir, name)), path.join(paths.stylesDir, targetStyle)];
    const chunks: string[] = [];

    for (const file of globalFiles) {
      if (await fs.pathExists(file)) {
        chunks.push(`/* ${path.relative(process.cwd(), file)} */\n${await fs.readFile(file, "utf8")}`);
      }
    }

    for (const template of templates) {
      const file = await CssResolver.findLocalStyleFile(template);

      if (file) {
        const css = await fs.readFile(file, "utf8");
        chunks.push(`/* ${path.relative(process.cwd(), file)} */\n${CssResolver.scopeCss(css, template)}`);
      }
    }

    return chunks.join("\n\n");
  }
}
