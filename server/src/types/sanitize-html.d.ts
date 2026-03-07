// Fallback declaration for sanitize-html.
// @types/sanitize-html is in devDependencies and is omitted when
// NODE_ENV=production. This file ensures TypeScript can compile on Render.
declare module 'sanitize-html' {
  type AllowedAttribute = string | { name: string; multiple?: boolean };

  interface Options {
    allowedTags?: string[] | false;
    allowedAttributes?: Record<string, AllowedAttribute[]> | false;
    allowedStyles?: Record<string, Record<string, RegExp[]>>;
    allowedClasses?: Record<string, string[]>;
    allowedIframeDomains?: string[];
    allowedIframeHostnames?: string[];
    allowedSchemes?: string[];
    allowedSchemesByTag?: Record<string, string[]>;
    allowProtocolRelative?: boolean;
    disallowedTagsMode?: 'discard' | 'escape' | 'recursiveEscape';
    enforceHtmlBoundary?: boolean;
    parseStyleAttributes?: boolean;
    selfClosing?: string[];
    transformTags?: Record<
      string,
      | string
      | ((tagName: string, attribs: Record<string, string>) => { tagName: string; attribs: Record<string, string> })
    >;
    exclusiveFilter?: (frame: { tag: string; attribs: Record<string, string>; text: string; mediaChildren: string[]; tagPosition: number }) => boolean;
    nonTextTags?: string[];
    nestingLimit?: number;
    textFilter?: (text: string, tagName: string) => string;
  }

  function sanitizeHtml(dirty: string, options?: Options): string;
  namespace sanitizeHtml {
    const defaults: Options;
  }

  export = sanitizeHtml;
}
