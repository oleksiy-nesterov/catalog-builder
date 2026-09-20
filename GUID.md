# Catalog Authoring Guide

This guide is for editorial and layout work: page composition, content structure, reusable templates and design-system usage. Technical setup, commands and build behavior live in [README.md](README.md).

The default catalog is a demo. It shows one possible structure, but it is not a required model. A real project can be a product catalog, magazine, brochure, lookbook, card set, report or any other paginated web/PDF publication.

## Catalog Root

Each publication lives in its own folder under `catalogs/`.

```text
catalogs/<catalog-name>/
├── catalog.json
├── assets/
├── fonts/
├── pages/
├── styles/
└── templates/
```

Use only the folders your publication needs. Shared images can live in `assets/`; page-specific images and data can live inside page folders; reusable fragments can live in `templates/`.

## Catalog Settings

`catalog.json` defines publication metadata, page format and page order.

```json
{
  "title": "Publication Title",
  "language": "en",
  "edition": "2027",
  "paperSize": "A4",
  "pages": ["cover", "article", "table-spread", "back-cover"]
}
```

`pages` is the source of truth for order. The renderer computes page indexes, left/right page side and page classes automatically.

## Page Format

When changing the page format, keep the catalog setting and print CSS in sync:

- `catalog.json`: change `paperSize`.
- `styles/pdf.css`: change `@page { size: ...; }`.
- `styles/pdf.css`: change `.page { height: ...; }` to the physical page height.

Examples:

- A4 portrait: `paperSize: "A4"`, `@page { size: A4; }`, `.page { height: 297mm; }`.
- A5 portrait: `paperSize: "A5"`, `@page { size: A5; }`, `.page { height: 210mm; }`.
- Letter portrait: `paperSize: "Letter"`, `@page { size: Letter; }`, `.page { height: 11in; }`.

The height value matters for PDF pages with full-height backgrounds, vertical alignment or content distributed from top to bottom.

## Pages

A page is a folder with an `index.html`. Add `styles.css`, Markdown, CSV, JSON and assets only when that page needs them.

```text
pages/<page-id>/
├── index.html
├── styles.css
├── content.md
├── data.csv
└── assets/
```

Local files are resolved relative to the current page folder:

```njk
{{ file.md('content.md') }}
{% for row in file.csv('data.csv') %}
  {{ row.name }}
{% endfor %}
<img src="{{ file('assets/photo.jpg') }}" alt="">
```

### Repeated Pages

Use repeated pages when one page template should render several pages from the same data set, such as a long list split into fixed-size batches.

```json
{
  "pages": [
    "cover",
    {
      "name": "regions",
      "repeat": 5
    },
    "back-cover"
  ]
}
```

The renderer expands that entry as if `regions` appeared five times in the page list. Every page receives `page.repeat`:

```json
{
  "index": 0,
  "count": 5
}
```

`index` is zero-based and `count` is the total number of repeats. Regular, non-repeated pages receive `{ "index": 0, "count": 1 }`.

Inside the template, use `page.repeat.index` to select the slice of local data for the current page:

```njk
{% set items = file('items.json') %}
{% set perPage = 5 %}
{% set start = page.repeat.index * perPage %}
{% set end = start + perPage %}

{% for item in items %}
  {% if loop.index0 >= start and loop.index0 < end %}
    <h3>{{ item.title }}</h3>
  {% endif %}
{% endfor %}
```

Use an empty string in `catalog.json` for an intentional blank print page:

```json
{
  "pages": ["cover", "", "chapter"]
}
```

## Layout CSS

Global page behavior belongs in shared styles. Page-specific CSS should focus on that page's composition.

Use `:scope` when a rule targets the page wrapper:

```css
:scope {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2em;
}
```

Prefer `em` for local spacing and component sizing when the value should scale with the page typography.

## Design System

Use existing HTML elements first:

- `h1` to `h6` for heading hierarchy.
- `p` for body copy.
- `b` for short bold emphasis.
- `i` for editorial notes or softer emphasis.
- `u` for marked or linked content.
- `small` for notes, codes and secondary details.
- `code` for file names, tags and technical labels.
- `hr` for black divider lines.
- `table`, `th`, `td` for simple black 1px grid tables.

Avoid adding local typography classes unless a page needs a special editorial composition.

## Colors

Use design-system variables instead of hard-coded values:

```css
color: var(--blue);
background: var(--yellow);
border-color: var(--black);
```

## Templates

Templates are reusable fragments stored in `templates/<template-name>/`.

```njk
{{ template('page-number', { offset: -1 }) }}
```

A template receives a wrapper class matching its folder name. Use `:scope` in template CSS to target that wrapper.

### Spread Images

Use `spread-image` when one background image should continue across two facing pages. Render the same template on both pages and keep `imageWidth` identical. Set the visible container size in page CSS.

```njk
{{ template('spread-image', {
  image: file('assets/spread.jpg'),
  imageWidth: '100em'
}) }}
```

On a left page the background is aligned to the left edge. On a right page the same template aligns to the right edge. For example, a `40em` wide container on the left page plus a `60em` wide container on the right page matches an `imageWidth` of `100em`.

## Tables

Use the shared table template for generated CSV or Markdown data:

```njk
{{ template('table', {
  data: file.csv('items.csv')
}) }}
```

```njk
{{ template('table', {
  data: file.md('items.md')
}) }}
```

For CSV, the first row's column names become the table header. For Markdown, surrounding text stays with the rendered Markdown content.

Manual HTML tables are useful for one-off layouts:

```html
<table>
  <thead>
    <tr>
      <th>Item</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cover</td>
      <td>Ready</td>
    </tr>
  </tbody>
</table>
```

Markdown column alignment can create inline alignment styles:

```md
| Name | Value |
| --- | ---: |
```

Use plain `---` when alignment should come only from the design system CSS.
