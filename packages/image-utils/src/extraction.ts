/**
 * Image URL Extraction
 *
 * Extracts image URLs from markdown, HTML, and base64 data URLs in text.
 * Used across Federation, Archive, and Architect for image processing.
 */

export interface ImageExtractionOptions {
  /** Include markdown image syntax `![alt](url)` (default: true) */
  includeMarkdown?: boolean;
  /** Include HTML img tags `<img src="url">` (default: true) */
  includeHTML?: boolean;
  /** Include base64 data URLs `data:image/...;base64,...` (default: true) */
  includeBase64?: boolean;
}

export interface ExtractedImage {
  /** The extracted URL or data URL */
  url: string;
  /** Source format where the image was found */
  source: 'markdown' | 'html' | 'base64';
  /** Surrounding context for debugging (optional) */
  context?: string;
}

/**
 * Extract all image URLs from text.
 *
 * Supports markdown, HTML, and base64 data URLs.
 * Returns deduplicated results.
 *
 * @param text - Text to extract image URLs from
 * @param options - Extraction options
 * @returns Array of extracted images with source information
 *
 * @example
 * ```typescript
 * const text = 'Check out ![portrait](avatar.png) and <img src="banner.jpg">';
 * const images = extractImageUrls(text);
 * // [
 * //   { url: 'avatar.png', source: 'markdown' },
 * //   { url: 'banner.jpg', source: 'html' }
 * // ]
 * ```
 */
export function extractImageUrls(
  text: string,
  options: ImageExtractionOptions = {},
): ExtractedImage[] {
  const {
    includeMarkdown = true,
    includeHTML = true,
    includeBase64 = true,
  } = options;

  const results: ExtractedImage[] = [];
  const seen = new Set<string>();

  // Extract markdown images: ![alt](url) or ![alt](<url>) or ![alt](url =dimensions)
  // Supports: standard, angle brackets, and SillyTavern dimension syntax
  if (includeMarkdown) {
    const markdownPattern = /!\[([^\]]*)\]\(<?([^>\s)]+)>?(?:\s*=[^)]+)?\)/g;
    let match: RegExpExecArray | null;

    while ((match = markdownPattern.exec(text)) !== null) {
      const url = match[2]?.trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        results.push({
          url,
          source: 'markdown',
          context: match[0],
        });
      }
    }
  }

  // Extract HTML img tags: <img src="url"> (quoted and unquoted)
  if (includeHTML) {
    // Quoted src
    const htmlQuotedPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;

    while ((match = htmlQuotedPattern.exec(text)) !== null) {
      const url = match[1]?.trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        results.push({
          url,
          source: 'html',
          context: match[0],
        });
      }
    }

    // Unquoted src (e.g., <img src=url>)
    const htmlUnquotedPattern = /<img[^>]+src=([^\s"'>]+)[^>]*>/gi;
    while ((match = htmlUnquotedPattern.exec(text)) !== null) {
      const url = match[1]?.trim();
      // Skip if it starts with a quote (already handled above)
      if (url && !url.startsWith('"') && !url.startsWith("'") && !seen.has(url)) {
        seen.add(url);
        results.push({
          url,
          source: 'html',
          context: match[0],
        });
      }
    }

    // CSS url() function: url(url), url("url"), url('url')
    // Common in background-image, background, content properties
    const cssUrlPattern = /url\(["']?([^)"']+)["']?\)/gi;
    while ((match = cssUrlPattern.exec(text)) !== null) {
      const url = match[1]?.trim();
      // Only include http(s) URLs to avoid CSS variables and relative paths
      if (url && (url.startsWith('http://') || url.startsWith('https://')) && !seen.has(url)) {
        seen.add(url);
        results.push({
          url,
          source: 'html',
          context: match[0],
        });
      }
    }
  }

  // Extract plain image URLs (not wrapped in any syntax)
  if (includeHTML) {
    // Plain URLs with image extensions (common on image hosts)
    const plainUrlPattern = /(?<![("'])(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|svg|avif|bmp))(?![)"'])/gi;
    let match: RegExpExecArray | null;

    while ((match = plainUrlPattern.exec(text)) !== null) {
      const url = match[0]?.trim();
      if (url && !seen.has(url)) {
        seen.add(url);
        results.push({
          url,
          source: 'html',
          context: url,
        });
      }
    }
  }

  // Extract base64 data URLs: data:image/...;base64,...
  if (includeBase64) {
    const dataUrlPattern = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g;
    let match: RegExpExecArray | null;

    while ((match = dataUrlPattern.exec(text)) !== null) {
      const url = match[0];
      if (!seen.has(url)) {
        seen.add(url);
        results.push({
          url,
          source: 'base64',
        });
      }
    }
  }

  return results;
}

/**
 * Extract only HTTP/HTTPS URLs (excludes data URLs and relative paths).
 *
 * Convenience wrapper around extractImageUrls that filters for remote URLs.
 *
 * @param text - Text to extract URLs from
 * @returns Array of extracted HTTP/HTTPS image URLs
 */
export function extractRemoteImageUrls(text: string): ExtractedImage[] {
  const all = extractImageUrls(text, { includeBase64: false });
  return all.filter((img) => /^https?:\/\//i.test(img.url));
}

/**
 * Extract only base64 data URLs.
 *
 * Convenience wrapper around extractImageUrls.
 *
 * @param text - Text to extract data URLs from
 * @returns Array of base64 image data URLs
 */
export function extractDataUrls(text: string): ExtractedImage[] {
  return extractImageUrls(text, {
    includeMarkdown: false,
    includeHTML: false,
    includeBase64: true,
  });
}

/**
 * Count images in text without extracting full details.
 *
 * More efficient than extractImageUrls when you only need the count.
 *
 * @param text - Text to count images in
 * @returns Total number of unique image references
 */
export function countImages(text: string): number {
  return extractImageUrls(text).length;
}
