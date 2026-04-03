import type { Page, PageElement, ChapterMeta } from '../types.ts'

export interface RefTarget {
  page: number
  elementId: string | null
}

/**
 * Builds a lookup index that maps cross-reference strings
 * (e.g. "26.8", "Figure 26.8-1", "Table 26.11-1") to page/element targets.
 */
export class ReferenceIndex {
  private map = new Map<string, RefTarget>()

  build(pages: Map<number, Page>, meta: ChapterMeta | null): void {
    this.map.clear()

    // 1) Section references from chapter metadata
    if (meta) {
      for (const sec of meta.sections) {
        this.add(sec.number, { page: sec.page, elementId: null })
        this.add(`Section ${sec.number}`, { page: sec.page, elementId: null })
        this.add(`Sections ${sec.number}`, { page: sec.page, elementId: null })
      }
    }

    // 2) Section references from element data (covers sections not in metadata)
    for (const [pageNum, page] of pages) {
      for (const el of page.elements) {
        if (el.section && !this.map.has(el.section)) {
          this.add(el.section, { page: pageNum, elementId: el.id })
        }
      }
    }

    // 3) Figure and table references — extract number from caption/text
    for (const [pageNum, page] of pages) {
      for (const el of page.elements) {
        if (el.type === 'figure') {
          this.indexFigureOrTable(el, pageNum, 'Figure')
        } else if (el.type === 'table') {
          this.indexFigureOrTable(el, pageNum, 'Table')
        }
      }
    }

    // 4) Formula/equation references — match by element ID patterns
    for (const [pageNum, page] of pages) {
      for (const el of page.elements) {
        if (el.type === 'formula') {
          this.indexFormula(el, pageNum)
        }
      }
    }
  }

  resolve(ref: string): RefTarget | null {
    // Direct lookup
    const direct = this.map.get(ref)
    if (direct) return direct

    // Strip "Section "/"Sections " prefix and try bare number
    const sectionMatch = ref.match(/^Sections?\s+(.+)$/)
    if (sectionMatch) {
      return this.map.get(sectionMatch[1]) ?? null
    }

    // Strip "Figure "/"Figures " prefix and try bare number
    const figMatch = ref.match(/^Figures?\s+(.+)$/)
    if (figMatch) {
      const num = figMatch[1]
      return this.map.get(`Figure ${num}`) ?? this.map.get(num)
        ?? this.map.get(`Figure ${num}A`) ?? null // e.g. "Figure 26.5-1" → "Figure 26.5-1A"
    }

    // Strip "Equation "/"Equations " prefix
    const eqMatch = ref.match(/^Equations?\s+\((.+)\)$/)
    if (eqMatch) {
      return this.map.get(eqMatch[1]) ?? null
    }

    // Bare parenthesized equation ref like "(26.11-10)"
    const bareEq = ref.match(/^\((.+)\)$/)
    if (bareEq) {
      return this.map.get(bareEq[1]) ?? null
    }

    return null
  }

  private add(key: string, target: RefTarget): void {
    // Don't overwrite — first match wins (keeps first page for continued figures)
    if (!this.map.has(key)) {
      this.map.set(key, target)
    }
  }

  private indexFigureOrTable(el: PageElement, pageNum: number, prefix: 'Figure' | 'Table'): void {
    const text = el.caption ?? el.text
    // Match "Figure 26.5-1A" or "Table 26.6-1" at start of text
    const pattern = new RegExp(`^\\*{0,2}${prefix}\\s+(\\d[\\w.\\-]+)`)
    const m = text.match(pattern)
    if (m) {
      const num = m[1].replace(/\.$/, '') // strip trailing dot
      this.add(`${prefix} ${num}`, { page: pageNum, elementId: el.id })
      this.add(num, { page: pageNum, elementId: el.id })
    }
  }

  private indexFormula(el: PageElement, pageNum: number): void {
    // Try to extract equation number from element ID patterns like "26.11-9"
    const idMatch = el.id.match(/^(\d+\.\d+(?:\.\d+)?-\d+[a-z]?)$/)
    if (idMatch) {
      this.add(idMatch[1], { page: pageNum, elementId: el.id })
      this.add(`Equation (${idMatch[1]})`, { page: pageNum, elementId: el.id })
    }

    // Extract all equation numbers from text, e.g. "(26.11-8)" or "(26.11-4.SI)"
    const text = el.text ?? ''
    const eqNums = text.matchAll(/\((\d+\.\d+(?:\.\d+)?-\d+[a-z]?)(?:\.SI)?\)/g)
    for (const m of eqNums) {
      this.add(m[1], { page: pageNum, elementId: el.id })
      this.add(`Equation (${m[1]})`, { page: pageNum, elementId: el.id })
      this.add(`Equations (${m[1]})`, { page: pageNum, elementId: el.id })
    }
  }
}

export const refIndex = new ReferenceIndex()
