<p align="center">
  <img width="360" src="media/logo.webp" alt="Publication Builder">
</p>

Publication Builder uses HTML and CSS as the source format for PDF publications. The core idea is simple: HTML + CSS -> static HTML output, lightweight PDF and print-oriented PDF through [Vivliostyle](https://vivliostyle.org/). It can be used for product publications, magazines, brochures, card sets, editorial reports and other print-friendly web documents.

## Structure

- `src/` contains application code only.
- `publications/` contains one folder per publication. Each publication folder is its own root for pages, templates, styles and assets.
- `dist/` contains generated output only.

The `publications/catalogue` publication is an example fixed-page catalogue. It already includes a design system, flexible templates and a working content structure, so it can be used as a foundation for custom publications. For fixed-page authoring, page layout conventions, design-system usage and content structure, see [CATALOG-GUID.md](CATALOG-GUID.md). For single-flow book-style publications that let Vivliostyle paginate long content automatically, see [BOOK-GUID.md](BOOK-GUID.md).

## Demo Publication

The `media/` folder contains preview pages from the demo publication:

<p style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;">
  <img src="media/1.jpg" height="150" alt="Demo catalogue page 1" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/2.jpg" height="150" alt="Demo catalogue page 2" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/3.jpg" height="150" alt="Demo catalogue page 3" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/4.jpg" height="150" alt="Demo catalogue page 4" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/5.jpg" height="150" alt="Demo catalogue page 5" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/6.jpg" height="150" alt="Demo catalogue page 6" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/7.jpg" height="150" alt="Demo catalogue page 7" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/8.jpg" height="150" alt="Demo catalogue page 8" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/9.jpg" height="150" alt="Demo catalogue page 9" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
</p>

See [media/catalogue-Ukraine-2027.pdf](media/catalogue-Ukraine-2027.pdf) for an example generated demo publication PDF.

<p style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;">
  <img src="media/1-1.jpg" height="150" alt="Demo book page 1" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/2-2.jpg" height="150" alt="Demo book page 2" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
  <img src="media/3-3.jpg" height="150" alt="Demo book page 3" style="box-shadow: 0 10px 28px rgb(0 0 0 / 20%);">
</p>

See [media/book-Ukraine-2027.pdf](media/book-Ukraine-2027.pdf) for an example generated demo publication PDF.

## Commands

```bash
npm install
npm run setup:print
npm run build:web -- <your-publication-folder>
npm run build:pdf -- <your-publication-folder>
npm run build:print -- <your-publication-folder>
npm run build -- <your-publication-folder>
npm run dev -- <your-publication-folder>
```

Output is written to:

- `dist/<your-publication-folder>/web/`
- `dist/<your-publication-folder>/pdf/<publication>-<title>[-<edition>].pdf`
- `dist/<your-publication-folder>/print/<publication>-<title>[-<edition>].pdf`

Publication names are required. For example, use `catalogue` for the fixed-page example or `book` for the long-flow example.

## Live Preview

Preview a specific publication:

```bash
npm run dev -- catalogue
```

Then open:

- `http://localhost:5173/catalogue/` for the whole catalogue publication
- `http://localhost:5173/catalogue/cover-front` for one page
- `http://localhost:5173/<your-publication-folder>/<page-name>` for another publication or page

The preview server renders from the current publication files on each request and reloads the browser when files inside `publications/` change.

## Adding A Publication Page

Create a folder in `publications/catalogue/pages/`, add `index.html`, then add the folder id to `publications/catalogue/publication.json`.

```text
publications/catalogue/pages/product-page/
├── index.html
├── data.json
├── description.md
└── assets/
```

The page index, page number and left/right side are computed from `publication.json`; they are not stored in page files.
Templates can also read `page.target`, which is `web`, `pdf` or `print` for the current render.

Page templates are normal [Nunjucks](https://mozilla.github.io/nunjucks/) files. Use `template()` to render a reusable template by folder name:

```njk
{% set data = file('data.json') %}
{{ template('product-details', { data }) }}
```

`file()` reads from the folder of the current page or template. Markdown, CSV, JSON, text and local assets are resolved automatically by extension.

`styles.css` is optional and is included when the page template is used.
Use `:scope` when a local style must target the current page wrapper. For a page, `:scope` becomes `.<page-id>.page` in the generated output.

```css
:scope {
  page: full-page;
  border: 0;
}

:scope .logo {
  width: 10vh;
}
```

Selectors without `:scope` are left as written. This keeps local CSS predictable and makes cross-context rules explicit.

Use an empty string in `publication.json` for blank pages:

```json
{
  "pages": ["cover-front", "", "about-page"]
}
```

Blank pages are rendered only in print PDF builds. Web pages and lightweight web PDF builds skip them, while the original page indexes and left/right classes of real pages stay unchanged.

## Templates

Templates live in `publications/catalogue/templates/<template-name>/index.html`.

Pages and templates work the same way: both can read local files, resolve local assets and define local CSS. Reusable fragments are rendered with:

```njk
{{ template('product-card') }}
```

Pass local parameters as the second argument:

```njk
{{ template('page-number', { offset: -1 }) }}
```

The renderer creates a wrapper for reusable templates automatically. The wrapper class is the template folder name, so `template('page-number')` renders inside `.page-number`.

Use `:scope` in template styles when a rule should target that generated template wrapper. For a template, `:scope` becomes `.<template-name>` in the generated output.

```html
<span class="number-value">{{ page.index + offset }}</span>
```

```css
:scope {
  position: absolute;
}

:scope .number-value {
  display: block;
}

.page-right :scope .number-value {
  text-align: right;
}
```

## Markdown And CSV

Pages and templates can read files directly from their own folder:

```njk
{{ file('description.md') }}
{% for row in file('products.csv') %}
  {{ row.code }}
{% endfor %}
```

There is no duplicate filename mapping in JSON.

## Assets

Local page and template assets are resolved relative to the current page or template folder:

```njk
{{ file('assets/chair-detail.jpg') }}
```

Global assets are resolved from the current publication root's `assets/` folder:

```njk
{{ global.asset('logo.svg') }}
```

## TIFF Print Replacement

Do not create separate web and print image folders. Keep browser-friendly JPG/PNG files beside optional TIFF siblings.

For print builds, `chair.jpg` resolves to `chair.tiff` if it exists. Web and lightweight PDF builds keep the original JPG/PNG. The print build uses a temporary `dist/<your-publication-folder>/.tmp/print/print-image-replacements.json` file with the discovered replacements, then removes `dist/<your-publication-folder>/.tmp` after a successful build.

PDF builds use a temporary target-specific Vivliostyle config. Lightweight web PDF builds do not enable CMYK post-processing. Print PDF builds enable `pdfPostprocess.cmyk`, so `device-cmyk()` colors are carried into print output.

`npm install` runs `install-print-tools.mjs`. It installs missing print tools automatically when a supported package manager is available:

- macOS: Homebrew (`brew install ghostscript xpdf`)
- Windows: winget (`ArtifexSoftware.GhostScript` and `oschwartz10612.Poppler`)
- Windows fallback: Chocolatey (`ghostscript` and `poppler`) or Scoop (`ghostscript` and `poppler`)

- `ghostscript` provides `gs` for press-ready PDF/X post-processing and CMYK ink coverage checks.
- `xpdf` or `poppler` provides `pdffonts`, which `press-ready` uses to inspect and outline fonts.

Set `PUBLICATION_BUILDER_SKIP_PRINT_TOOLS=1` before `npm install` to skip system tool setup.

On Windows, if no package manager is available, install the tools manually and make sure `gswin64c`/`gswin32c` and `pdffonts` are available in `PATH`, then run:

```powershell
npm run setup:print
```

If Ghostscript (`gs`) and `pdffonts` are installed, the generated Vivliostyle config also enables `preflight: "press-ready-local"` for print-oriented PDF/X post-processing. Without those tools, the pilot still creates the print PDF in `dist/<your-publication-folder>/print/` and prints a console warning.
