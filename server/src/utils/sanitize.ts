import sanitizeHtml from 'sanitize-html';

/**
 * Strip all HTML tags and attributes from a string.
 * Allows no tags at all — pure plain-text output.
 * Apply to any user-supplied field before persisting to MongoDB.
 */
export const sanitizeText = (input: string): string =>
  sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} });
