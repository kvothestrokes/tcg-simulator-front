/* Vocabulario conocido del juego.
   El parser NO bloquea keywords desconocidas: cualquier texto
   escrito entre < > se convierte en keyword válida. */

export interface KeywordGroup {
  id: string
  label: string
  /* tono usado para colorear el badge dentro del texto y en la fila de keywords */
  tone: 'armor' | 'fighter' | 'support' | 'faction' | 'generic'
  words: string[]
}

export const KEYWORD_GROUPS: KeywordGroup[] = [
  {
    id: 'acorazado',
    label: 'Acorazado',
    tone: 'armor',
    words: ['Muralla', 'Escolta', 'Guardián', 'Fuego de cobertura', 'Baluarte'],
  },
  {
    id: 'caza',
    label: 'Caza',
    tone: 'fighter',
    words: ['Ignición', 'Evasión', 'Asalto', 'Ráfaga'],
  },
  {
    id: 'soporte',
    label: 'Soporte',
    tone: 'support',
    words: ['Ingeniería', 'Suministros', 'Coordinar', 'Reparar'],
  },
  {
    id: 'faccion',
    label: 'Facción',
    tone: 'faction',
    words: ['Procesar', 'Presión', 'Snowball', 'Chatarra', 'Válvula'],
  },
  {
    id: 'genericas',
    label: 'Genéricas',
    tone: 'generic',
    words: [
      'Primer golpe',
      'Perforante',
      'Sigilo',
      'Escuadrón',
      'Kamikaze',
      'Refrigeración',
      'Sobremarcha',
      'Reactor frío',
      'Salvamento',
      'Contrabando',
      'Escáner',
      'Rescate',
      'Baliza',
      'Modular',
      'Interfaz reforzada',
      'Portanaves',
    ],
  },
]

export type KeywordTone = KeywordGroup['tone']

const TONE_INDEX: Record<string, KeywordTone> = (() => {
  const index: Record<string, KeywordTone> = {}
  for (const group of KEYWORD_GROUPS) {
    for (const word of group.words) index[normalizeKeyword(word)] = group.tone
  }
  return index
})()

/** Normaliza una keyword para poder comparar ignorando acentos, mayúsculas
 *  y parámetros numéricos (`Perforante 2` → `perforante`). */
export function normalizeKeyword(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[+-]?\d+(?:[.,]\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Devuelve el tono cromático de una keyword; `unknown` si es inventada. */
export function getKeywordTone(raw: string): KeywordTone | 'unknown' {
  return TONE_INDEX[normalizeKeyword(raw)] ?? 'unknown'
}

/** ¿La keyword pertenece al vocabulario oficial? (sólo informativo) */
export function isKnownKeyword(raw: string): boolean {
  return getKeywordTone(raw) !== 'unknown'
}

export const ALL_KEYWORDS: string[] = KEYWORD_GROUPS.flatMap((g) => g.words)
