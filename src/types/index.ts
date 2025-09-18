/**
 * Epicurrents HTM reader types.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { FileFormatImporter } from '@epicurrents/core/dist/types'

export type ConfigReadFile = {
    format?: string
    mime?: string
    name?: string
    url?: string
}

export interface DocumentFileImporter extends FileFormatImporter {

}

export type HtmDocumentFormat = "html" | "markdown"

export type HtmSourceFileContext = {
    file: File | null
    page: number
    url: string | null
}
