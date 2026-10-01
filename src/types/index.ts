/**
 * Epicurrents HTM reader types.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type FileFormatImporter } from '@epicurrents/core/types'

/** Overrides for the properties a study file would otherwise take from the imported file itself. */
export type ConfigReadFile = {
    format?: string
    mime?: string
    name?: string
    url?: string
}

/**
 * Importer of a document file format. A named seam for the document importers: it adds nothing to
 * the core interface yet, and exists so the packages that build on it name this reader's contract
 * rather than core's.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- see above.
export interface DocumentFileImporter extends FileFormatImporter {
}

/** Document formats this reader can read. One importer and one worker serve each. */
export type HtmDocumentFormat = 'html' | 'markdown'

/**
 * One page's source. Mirrors the source shape the document module sends with `set-sources` and must
 * stay assignable to it; nothing checks that at build time, since a reader declares no dependency on
 * the modules that consume it.
 */
export type HtmSourceFileContext = {
    /** The file itself, when the document was imported from one. Preferred over {@link url}. */
    file: File | null
    /** Page number (1-based) this source holds. */
    page: number
    /** Address to fetch the source from, when it has no file. */
    url: string | null
}
