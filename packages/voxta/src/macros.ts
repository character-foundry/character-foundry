/**
 * Macro Conversion
 *
 * Converts between Voxta-style macros (with spaces) and standard macros.
 *
 * Voxta uses: {{ user }}, {{ char }}
 * Standard uses: {{user}}, {{char}}
 */

/**
 * Convert Voxta-style macros to standard format (no spaces)
 */
export function voxtaToStandard(text: string): string {
  if (!text) return text;

  let result = text;

  // Replace {{ user }} variants with {{user}}
  result = result.replace(/\{\{\s*user\s*\}\}/gi, (match) => {
    const isUpperCase = match.includes('User') || match.includes('USER');
    return isUpperCase ? '{{User}}' : '{{user}}';
  });

  // Replace {{ char }} variants with {{char}}
  result = result.replace(/\{\{\s*char\s*\}\}/gi, (match) => {
    const isUpperCase = match.includes('Char') || match.includes('CHAR');
    return isUpperCase ? '{{Char}}' : '{{char}}';
  });

  return result;
}

/**
 * Convert standard macros to Voxta-style format (with spaces)
 */
export function standardToVoxta(text: string): string {
  if (!text) return text;

  let result = text;

  // Replace {{user}} variants with {{ user }}
  result = result.replace(/\{\{user\}\}/gi, (match) => {
    const isUpperCase = match.includes('User') || match.includes('USER');
    return isUpperCase ? '{{ User }}' : '{{ user }}';
  });

  // Replace {{char}} variants with {{ char }}
  result = result.replace(/\{\{char\}\}/gi, (match) => {
    const isUpperCase = match.includes('Char') || match.includes('CHAR');
    return isUpperCase ? '{{ Char }}' : '{{ char }}';
  });

  return result;
}
