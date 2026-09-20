# Flow-Page Book Authoring Guide

This guide is for flow-page editorial and layout work: one long HTML flow that Vivliostyle splits into physical pages. Technical setup, commands and build behavior live in [README.md](README.md). For fixed-page publications where every item in `publication.json` is designed as one physical page, use [CATALOG-GUID.md](CATALOG-GUID.md).

Use this model for chapters, reports, essays and manuals where content should continue naturally across pages with running headers, page numbers, images, tables and columns.

The `book` publication is a demo of a flow-page book. It shows one possible structure, but it is not a required model. A real project can be a history chapter, essay collection, annual report, long-form article, manual or any other continuous web/PDF publication.

## Build And Preview

Build the example book publication:

```bash
npm run build:web -- book
npm run build:pdf -- book
npm run build:print -- book
npm run build -- book
```

Preview it locally:

```bash
npm run dev -- book
```

Then open:

- `http://localhost:5173/book/`
- `http://localhost:5173/book/story`

## Publication Root

A book publication can still use the normal publication folder structure:

```text
publications/book/
├── publication.json
├── fonts/
├── pages/
│   └── story/
│       ├── index.html
│       ├── styles.css
│       ├── history.csv
│       └── assets/
├── styles/
└── templates/
```

Use only the folders your publication needs. Shared images can live in `assets/`; page-specific images and data can live inside page folders; reusable fragments can live in `templates/`.

## Publication Settings

`publication.json` defines publication metadata, page format and page order.

```json
{
  "title": "Book",
  "language": "en",
  "edition": "2027",
  "paperSize": "A4",
  "pages": ["story"]
}
```

The key difference is `pages`: a flow-page book should usually contain one page id. That page can contain a long article, multiple sections, figures, tables and column layouts. Vivliostyle will paginate the long rendered HTML into as many physical pages as needed.

`edition` is optional. When it is present, generated PDF filenames include it; when it is omitted, filenames use only the publication folder and title.

## Page Content Structure

The `story` page is a single flow. It does not need an extra wrapper around all content; the renderer already wraps the page in `.story.page`.

Use a top-level `header` for the opener and top-level `section` / `figure` elements for the rest of the flow:

```html
<header>
  <p class="label">A single-flow Vivliostyle sample</p>
  <h1>Ukraine: <span style="display: inline-block;">A History</span> Written in Crossroads</h1>
  <p class="author">Publication Builder</p>
  <p class="source">A sample long-form chapter...</p>
</header>

<section class="chapter">
  <p>...</p>
</section>

<figure class="wide-figure">
  <img src="{{ file('assets/kyiv.jpg') }}" alt="Kyiv">
  <figcaption>Kyiv, used here as a page-flow image example.</figcaption>
</figure>
```

The opener text also provides running-header values through CSS `string-set`.

## Page Format

When changing the book page format, keep the publication setting and Vivliostyle page CSS in sync:

- `publication.json`: change `paperSize`.
- `styles/pdf.css`: change `@page book { size: ...; }`.
- `styles/pdf.css`: adjust the `@page book` margins for the new trim size.

Examples:

- A4 portrait: `paperSize: "A4"`, `@page book { size: A4; }`.
- A5 portrait: `paperSize: "A5"`, `@page book { size: A5; }`.
- Letter portrait: `paperSize: "Letter"`, `@page book { size: Letter; }`.

Unlike fixed-page publications, book publications should not set `.page` to the physical page height. Keep the HTML flow flexible and let Vivliostyle create physical pages.

## Flow Page CSS

The page-level CSS assigns the named Vivliostyle page and leaves width, height and pagination to the shared web/PDF styles:

```css
:scope {
  page: book;
}
```

Keep web-only centering in `styles/web.css`, not in the page CSS:

```css
body {
  margin: 3em 0;
}

.page {
  max-width: 720px;
  margin: 0 auto;
}
```

Keep PDF-specific page padding in `styles/pdf.css`. The printable width should come from `@page` margins, not from a local `max-width`.

## Page Size And Margins

Define the physical page with `@page`. Use mirrored margins for facing pages:

```css
@page book {
  size: A4;
  margin: 24mm 24mm 24mm 24mm;
}

@page book:left {
  margin-left: 30mm;
}

@page book:right {
  margin-right: 30mm;
}
```

The larger inside margin gives a book spread more breathing room near the binding.

## Page Numbers

Use Vivliostyle margin boxes and CSS counters:

```css
@page book {
  @bottom-center {
    content: counter(page);
    font-family: var(--font-family);
    font-size: 1em;
    font-weight: 600;
  }
}
```

The current book keeps page numbers on every page, including the title page.

## Running Headers

Use `string-set` on elements in the document, then read those strings from `@page` margin boxes.

```css
:scope header h1 {
  string-set: book-title content(text);
}

:scope header .author {
  string-set: book-author content(text);
}

@page book:left {
  @top-left {
    content: string(book-title);
  }
}

@page book:right {
  @top-right {
    content: string(book-author);
  }
}
```

To keep the title page clean:

```css
@page book:first {
  @top-left {
    content: normal;
  }

  @top-right {
    content: normal;
  }
}
```

## Page Breaks

Use page breaks sparingly. Let Vivliostyle paginate most content automatically.

```css
:scope header {
  break-after: page;
  page-break-after: always;
}

:scope section,
:scope table {
  break-inside: avoid;
}

:scope h2,
:scope h3 {
  break-after: avoid;
}

:scope p {
  orphans: 3;
  widows: 3;
}
```

## Images

Store page images in `pages/<page-id>/assets/` and reference them with `file()`.

```html
<figure class="wide-figure">
  <img src="{{ file('assets/kyiv.jpg') }}" alt="Kyiv">
  <figcaption>Kyiv, used here as a page-flow image example.</figcaption>
</figure>
```

The current `wide-figure` style keeps the image full-width inside the page content area:

```css
:scope .wide-figure {
  margin: 1em 0;

  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }
}
```

For print builds, add a same-name `.tiff` next to the source image when a press-ready replacement is needed:

```text
assets/kyiv.jpg
assets/kyiv.tiff
```

The print build will use the TIFF as a replacement while keeping the HTML source pointed at the web-friendly image.

## CSV Tables

Copy or create the shared table template inside the book publication:

```text
publications/book/templates/table/index.html
```

Create a CSV file beside the page:

```csv
period,reference point,why it matters
988,Christianization of Rus,Linked Kyiv to Byzantine religious artistic and diplomatic worlds
1991,Independence referendum,Confirmed sovereign statehood through a nationwide democratic vote
```

Render it in the book flow:

```njk
{{ template('table', {
  data: file.csv('history.csv')
}) }}
```

The first CSV row becomes the table header. Keep table text concise, because wide tables have less room in printed book margins.

## Multi-Column Sections

Use columns for short editorial sections, not for the entire chapter.

```css
.columns-2 {
  column-count: 2;
  column-gap: 1em;
}

.columns-3 {
  column-count: 3;
  column-gap: 1em;
}

.columns-2 h3,
.columns-3 h3 {
  column-span: all;
}
```

Avoid placing large tables inside multi-column containers. Put tables between column sections so Vivliostyle can keep them readable.

## Preflight Checklist

After building a flow-page publication, check that:

- the PDF has more physical pages than `publication.json` entries;
- the first page has the intended title-page treatment;
- left and right pages show the correct running headers;
- page numbers appear in the margin box;
- images and CSV tables do not split awkwardly;
- print builds embed fonts and use any expected TIFF replacements.
