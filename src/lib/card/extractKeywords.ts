/* ============================================================
   Parser de keywords.
   Fuente de verdad única: `texto_efecto`.
   Todo lo que el usuario escriba entre < > es una keyword,
   incluyendo parámetros: <Perforante 2>, <Asalto +5>, ...
   Color opcional: <Chatarra#ff0000> o <Perforante 2#0f0>
   ============================================================ */

export const KEYWORD_REGEX = /<([^<>]+)>/g

/** Sufijo de color al final del contenido: #rgb, #rrggbb o #rrggbbaa. */
const COLOR_SUFFIX = /\s*#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export interface ParsedKeyword {
  value: string
  color?: string
}

export type EffectToken =
  | { kind: 'text'; value: string }
  | { kind: 'keyword'; value: string; color?: string }

function expandHex(hex: string): string {
  const lower = hex.toLowerCase()
  if (lower.length === 3) {
    return `#${lower[0]}${lower[0]}${lower[1]}${lower[1]}${lower[2]}${lower[2]}`
  }
  return `#${lower}`
}

/**
 * Separa el nombre visible de un color hexadecimal opcional.
 * Si el sufijo no es hex válido, se deja como parte del nombre.
 */
export function parseKeywordMarkup(raw: string): ParsedKeyword {
  const keyword = raw.trim().replace(/\s+/g, ' ')
  if (!keyword) return { value: '' }

  const colorMatch = keyword.match(COLOR_SUFFIX)
  if (!colorMatch || colorMatch.index === undefined) return { value: keyword }

  const value = keyword.slice(0, colorMatch.index).trim()
  if (!value) return { value: keyword }

  return { value, color: expandHex(colorMatch[1]) }
}

/** Variables CSS para pintar una keyword con color custom. */
export function keywordColorStyle(color?: string): { ['--kw']: string; color: string } | undefined {
  if (!color) return undefined
  return { ['--kw']: color, color }
}

function collectKeywords(text: string): ParsedKeyword[] {
  if (!text) return []
  const found: ParsedKeyword[] = []
  const seen = new Set<string>()
  const re = new RegExp(KEYWORD_REGEX.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const parsed = parseKeywordMarkup(match[1])
    if (!parsed.value) continue
    const dedupeKey = parsed.value.toLocaleLowerCase('es')
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    found.push(parsed)
  }
  return found
}

/**
 * Devuelve todas las keywords encontradas en un texto, sin duplicados
 * y respetando el orden de aparición. El color #hex no forma parte del nombre.
 *
 *   extractKeywords('<Escolta> ... genera 2 <Chatarra#9ad83a>.')
 *   // → ['Escolta', 'Chatarra']
 */
export function extractKeywords(text: string): string[] {
  return collectKeywords(text).map((kw) => kw.value)
}

/** Igual que extractKeywords, incluyendo el color custom si existe. */
export function extractParsedKeywords(text: string): ParsedKeyword[] {
  return collectKeywords(text)
}

/**
 * Trocea el texto de efecto en segmentos de texto plano y keywords,
 * eliminando los delimitadores < > y el sufijo #hex de la salida renderizada.
 */
export function tokenizeEffectText(text: string): EffectToken[] {
  if (!text) return []
  const tokens: EffectToken[] = []
  const re = new RegExp(KEYWORD_REGEX.source, 'g')
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', value: text.slice(lastIndex, match.index) })
    }
    const parsed = parseKeywordMarkup(match[1])
    if (parsed.value) tokens.push({ kind: 'keyword', ...parsed })
    lastIndex = re.lastIndex
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', value: text.slice(lastIndex) })
  }
  return tokens
}

/** Texto sin delimitadores ni sufijo de color, útil para exportaciones o tooltips. */
export function stripKeywordMarkers(text: string): string {
  return (text || '').replace(new RegExp(KEYWORD_REGEX.source, 'g'), (_m, inner: string) =>
    parseKeywordMarkup(inner).value,
  )
}
