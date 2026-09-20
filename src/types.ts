export type BuildTarget = "web" | "pdf" | "print";

export type PageSide = "left" | "right";

export type PaperSize =
  | "A0"
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "A5"
  | "A6"
  | "B0"
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "B5"
  | "B6"
  | "Letter"
  | "Legal"
  | "Ledger";

export type Catalog = {
  title: string;
  language: string;
  edition: string;
  paperSize: PaperSize;
  pages: string[];
};

export type PageRepeat = {
  index: number;
  count: number;
};

export type PageMeta = {
  id: string;
  index: number;
  side: PageSide;
  className: string;
  repeat: PageRepeat;
};
