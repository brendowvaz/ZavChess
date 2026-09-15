/** Pure runtime overlay. No fs, Nest, Prisma, JSON imports, or database writes. */
export interface EducationSource {
  title: string; url: string; scope: 'identity-and-moves'; openingId: string;
}
export interface EducationLine {
  openingId: string; name: string; pgn: string; moves: string[]; fen: string;
  annotations: { ply: number; uci: string; san: string; text: string }[];
}
export interface FamilyEducationGuide {
  family: string; displayName: string; aliases: string[]; overview: string;
  whitePlan: string[]; blackPlan: string[]; commonMistakes: string[]; lessonIds: string[];
  scope: 'family' | 'broad-family'; reviewStatus: 'human-review-pending';
  audit: string; sources: EducationSource[]; referenceLine: EducationLine;
}
export interface VariationEducationGuide {
  id: string; family: string; name: string; title: string; aliases: string[];
  distinction: string; whitePlan: string[]; blackPlan: string[]; commonMistakes: string[];
  reviewStatus: 'human-review-pending'; sources: EducationSource[];
  match: { exactNames: string[]; uciPrefixes: string[][] };
  line: EducationLine;
}
export interface FamilyEducationFile { schemaVersion: 1; guides: FamilyEducationGuide[] }
export interface VariationEducationFile { schemaVersion: 1; variations: VariationEducationGuide[] }
export interface OpeningEducation {
  version: 1; familyGuide: FamilyEducationGuide | null; variationGuide: VariationEducationGuide | null;
  coverage: 'variation' | 'family-only' | 'catalog-only'; notice: string;
}
export interface EducationOpening { family: string; name: string; moves: unknown }

const uci = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
export function isUciPrefix(prefix: readonly string[], moves: readonly string[]): boolean {
  return prefix.length > 0 && prefix.length <= moves.length && prefix.every((move, index) => move === moves[index]);
}

/** Requires BOTH a complete allowlisted catalog name and a verified UCI prefix.
 * Known alternate orders are explicit prefixes. No fuzzy name, ECO, FEN-only,
 * reverse prefix, or substring fallback can silently classify a different line.
 */
export function findVariationGuide(opening: EducationOpening, file: VariationEducationFile): VariationEducationGuide | null {
  if (!Array.isArray(opening.moves) || !opening.moves.every((move): move is string => typeof move === 'string' && uci.test(move))) return null;
  const moves: string[] = opening.moves;
  const candidates = file.variations.flatMap(guide => {
    if (guide.family !== opening.family || !guide.match.exactNames.includes(opening.name)) return [];
    const lengths = guide.match.uciPrefixes.filter(prefix => isUciPrefix(prefix, moves)).map(prefix => prefix.length);
    return lengths.length ? [{ guide, length: Math.max(...lengths) }] : [];
  }).sort((a, b) => b.length - a.length || a.guide.id.localeCompare(b.guide.id));
  // Ambiguity means missing editorial coverage, not permission to guess.
  if (candidates[0] && candidates[1]?.length === candidates[0].length) return null;
  return candidates[0]?.guide ?? null;
}

export function openingEducation(opening: EducationOpening, families: FamilyEducationFile, variations: VariationEducationFile): OpeningEducation {
  const familyGuide = families.guides.find(guide => guide.family === opening.family) ?? null;
  const variationGuide = findVariationGuide(opening, variations);
  return {
    version: 1, familyGuide, variationGuide,
    coverage: variationGuide ? 'variation' : familyGuide ? 'family-only' : 'catalog-only',
    notice: variationGuide
      ? 'Guia desta variante com linha de referência. A fonte verifica nomes e lances, não certifica os planos.'
      : familyGuide
        ? 'Esta linha usa a orientação geral da família.'
        : 'Esta família tem somente linhas do catálogo.',
  };
}

export function normalizeOpeningSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Feed returned English terms into the service's existing OR/contains query.
 * Expand complete aliases only: partial "drag" must not silently pick a branch.
 */
export function openingSearchTerms(query: string, families: FamilyEducationFile, variations: VariationEducationFile): string[] {
  const normalized = normalizeOpeningSearch(query);
  if (!normalized) return [];
  const terms = new Set([query.trim()]);
  for (const guide of families.guides) {
    if ([guide.displayName, ...guide.aliases].some(alias => normalizeOpeningSearch(alias) === normalized)) terms.add(guide.family);
  }
  for (const guide of variations.variations) {
    if ([guide.title, ...guide.aliases].some(alias => normalizeOpeningSearch(alias) === normalized)) terms.add(guide.name);
  }
  return [...terms];
}
