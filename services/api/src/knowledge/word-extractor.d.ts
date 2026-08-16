declare module "word-extractor" {
  type ExtractOptions = { trim: boolean } | { trim: boolean; keepLineBreaks: boolean };

  class Document {
    getBody(options?: ExtractOptions): string;
    getFootnotes(options?: ExtractOptions): string;
    getEndnotes(options?: ExtractOptions): string;
    getHeaders(options?: ExtractOptions): string;
  }

  export default class WordExtractor {
    extract(source: string | Buffer): Promise<Document>;
  }
}