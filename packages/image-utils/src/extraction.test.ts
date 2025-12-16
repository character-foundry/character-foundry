/**
 * Image URL extraction tests
 */

import { describe, it, expect } from 'vitest';
import {
  extractImageUrls,
  extractRemoteImageUrls,
  extractDataUrls,
  countImages,
} from './extraction.js';

describe('extractImageUrls', () => {
  describe('markdown extraction', () => {
    it('extracts simple markdown images', () => {
      const text = 'Check out ![avatar](https://example.com/avatar.png)';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('https://example.com/avatar.png');
      expect(images[0].source).toBe('markdown');
      expect(images[0].context).toContain('![avatar]');
    });

    it('extracts multiple markdown images', () => {
      const text = `
        ![img1](url1.png)
        ![img2](url2.jpg)
        ![img3](url3.webp)
      `;
      const images = extractImageUrls(text);

      expect(images).toHaveLength(3);
      expect(images.map((i) => i.url)).toEqual([
        'url1.png',
        'url2.jpg',
        'url3.webp',
      ]);
    });

    it('handles markdown with empty alt text', () => {
      const text = '![](image.png)';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('image.png');
    });

    it('deduplicates identical markdown URLs', () => {
      const text = '![a](same.png) and ![b](same.png)';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('same.png');
    });
  });

  describe('HTML extraction', () => {
    it('extracts HTML img tags with double quotes', () => {
      const text = '<img src="banner.jpg" alt="Banner">';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('banner.jpg');
      expect(images[0].source).toBe('html');
    });

    it('extracts HTML img tags with single quotes', () => {
      const text = "<img src='portrait.png'>";
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('portrait.png');
    });

    it('handles complex img tags with multiple attributes', () => {
      const text =
        '<img class="avatar" src="https://cdn.example.com/img.png" width="200" height="200">';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('https://cdn.example.com/img.png');
    });

    it('extracts multiple img tags', () => {
      const text = `
        <img src="img1.png">
        <img src="img2.jpg">
      `;
      const images = extractImageUrls(text);

      expect(images).toHaveLength(2);
      expect(images.map((i) => i.url)).toEqual(['img1.png', 'img2.jpg']);
    });
  });

  describe('base64 extraction', () => {
    it('extracts base64 PNG data URLs', () => {
      const text =
        'Embedded: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].source).toBe('base64');
      expect(images[0].url).toContain('data:image/png;base64,');
    });

    it('extracts base64 JPEG data URLs', () => {
      const text = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toContain('data:image/jpeg;base64,');
    });

    it('extracts multiple base64 images', () => {
      const text =
        'First: data:image/png;base64,abc123 Second: data:image/jpeg;base64,xyz789';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(2);
      expect(images[0].url).toContain('png');
      expect(images[1].url).toContain('jpeg');
    });

    it('deduplicates identical base64 URLs', () => {
      const dataUrl = 'data:image/png;base64,abc123';
      const text = `${dataUrl} and ${dataUrl}`;
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
    });
  });

  describe('mixed extraction', () => {
    it('extracts from markdown, HTML, and base64', () => {
      const text = `
        ![md](markdown.png)
        <img src="html.jpg">
        data:image/png;base64,xyz123
      `;
      const images = extractImageUrls(text);

      expect(images).toHaveLength(3);
      expect(images.map((i) => i.source)).toEqual([
        'markdown',
        'html',
        'base64',
      ]);
    });

    it('deduplicates across different formats', () => {
      const text = '![a](same.png) <img src="same.png">';
      const images = extractImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].source).toBe('markdown'); // First found
    });
  });

  describe('extraction options', () => {
    it('skips markdown when disabled', () => {
      const text = '![md](img.png) <img src="html.jpg">';
      const images = extractImageUrls(text, { includeMarkdown: false });

      expect(images).toHaveLength(1);
      expect(images[0].source).toBe('html');
    });

    it('skips HTML when disabled', () => {
      const text = '![md](img.png) <img src="html.jpg">';
      const images = extractImageUrls(text, { includeHTML: false });

      expect(images).toHaveLength(1);
      expect(images[0].source).toBe('markdown');
    });

    it('skips base64 when disabled', () => {
      const text = 'data:image/png;base64,abc ![md](img.png)';
      const images = extractImageUrls(text, { includeBase64: false });

      expect(images).toHaveLength(1);
      expect(images[0].source).toBe('markdown');
    });

    it('returns empty array when all disabled', () => {
      const text = '![md](img.png) <img src="html.jpg"> data:image/png;base64,x';
      const images = extractImageUrls(text, {
        includeMarkdown: false,
        includeHTML: false,
        includeBase64: false,
      });

      expect(images).toHaveLength(0);
    });
  });

  describe('extractRemoteImageUrls', () => {
    it('extracts only HTTP/HTTPS URLs', () => {
      const text = `
        ![remote](https://example.com/img.png)
        ![local](relative/path.jpg)
        data:image/png;base64,abc
      `;
      const images = extractRemoteImageUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('https://example.com/img.png');
    });

    it('includes both http and https', () => {
      const text =
        '![a](http://example.com/a.png) ![b](https://example.com/b.png)';
      const images = extractRemoteImageUrls(text);

      expect(images).toHaveLength(2);
    });
  });

  describe('extractDataUrls', () => {
    it('extracts only base64 data URLs', () => {
      const text = `
        data:image/png;base64,abc
        ![remote](https://example.com/img.png)
      `;
      const images = extractDataUrls(text);

      expect(images).toHaveLength(1);
      expect(images[0].source).toBe('base64');
    });
  });

  describe('countImages', () => {
    it('returns correct count', () => {
      const text = '![a](a.png) ![b](b.jpg) <img src="c.gif">';
      expect(countImages(text)).toBe(3);
    });

    it('counts deduplicated images', () => {
      const text = '![a](same.png) <img src="same.png">';
      expect(countImages(text)).toBe(1);
    });

    it('returns zero for no images', () => {
      const text = 'Just plain text with no images';
      expect(countImages(text)).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(extractImageUrls('')).toEqual([]);
    });

    it('handles text with no images', () => {
      expect(extractImageUrls('Plain text')).toEqual([]);
    });

    it('handles malformed markdown', () => {
      const text = '![broken(no-closing-paren';
      expect(extractImageUrls(text)).toEqual([]);
    });

    it('extracts unquoted HTML attributes', () => {
      // Unquoted attributes are valid HTML5 and now supported
      const text = '<img src=no-quotes>';
      const images = extractImageUrls(text);
      expect(images).toHaveLength(1);
      expect(images[0].url).toBe('no-quotes');
      expect(images[0].source).toBe('html');
    });

    it('trims whitespace from URLs', () => {
      const text = '![test](  https://example.com/img.png  )';
      const images = extractImageUrls(text);

      expect(images[0].url).toBe('https://example.com/img.png');
    });
  });
});
