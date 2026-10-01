/**
 * Epicurrents HTM importer.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericStudyImporter } from '@epicurrents/core'
import type {
    AssociatedFileType,
    StudyContextFile,
    StudyFileContext,
} from '@epicurrents/core/types'
import type {
    ConfigReadFile,
    DocumentFileImporter,
    HtmDocumentFormat,
} from '#types'
import { Log } from 'scoped-event-log'
import InlineHtmlWorker from '#workers/html.worker.ts?worker&inline'
import InlineMarkdownWorker from '#workers/markdown.worker.ts?worker&inline'

const SCOPE = 'HtmImporter'

/**
 * File types each format accepts. An importer advertises only its own: the file picker builds its
 * filter from these, and offering an extension this importer cannot read produces a study whose
 * declared format and whose worker disagree.
 */
const FILE_TYPES = {
    html: {
        accept: {
            'text/html': ['.htm', '.html'],
        },
        description: 'HyperText Markup Language (HTML)',
    },
    markdown: {
        accept: {
            'text/markdown': ['.md', '.markdown'],
        },
        description: 'Markdown',
    },
} as Record<HtmDocumentFormat, AssociatedFileType>

export default class HtmImporter extends GenericStudyImporter implements DocumentFileImporter {
    protected _format: HtmDocumentFormat

    /**
     * An importer serves one format, because the worker it hands over is chosen when it is
     * constructed and a document module asks for that worker without naming a file. A setup offering
     * both formats registers one importer for each.
     * @param format - Document format this importer reads.
     */
    constructor (format: HtmDocumentFormat) {
        // A format outside the two would put an undefined entry in the file types, and the failure
        // would surface as a type error deep in the file-name matching rather than here.
        const known = Object.hasOwn(FILE_TYPES, format) ? format : 'markdown'
        if (known !== format) {
            Log.error(`Unknown document format '${format}', reading as Markdown instead.`, SCOPE)
        }
        super(SCOPE, [], [FILE_TYPES[known]])
        this._format = known
    }

    /**
     * Worker for this importer's format. Both formats have one: a document module refuses to build a
     * resource without a worker, so a format that returned none here could be imported and never
     * opened.
     */
    getFileTypeWorker (): Worker | null {
        const workerOverride = this._workerOverrides.get(this._format)
        if (workerOverride) {
            const worker = workerOverride()
            Log.registerWorker(worker)
            return worker
        }
        const worker = this._format === 'html' ? new InlineHtmlWorker() : new InlineMarkdownWorker()
        Log.registerWorker(worker)
        return worker
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- the importer contract returns a promise.
    async importFile (source: File | StudyFileContext, config?: ConfigReadFile) {
        const file = (source as StudyFileContext).file || source as File
        Log.debug(`Loading HTM from file ${file.webkitRelativePath || file.name}.`, SCOPE)
        const fileName = config?.name || file.name || ''
        const fileFormat = config?.format ? config.format
                            : fileName.endsWith('.htm') || fileName.endsWith('.html')
                                ? 'html'
                                : fileName.endsWith('.md') || fileName.endsWith('.markdown')
                                    ? 'markdown' : this._format
        const studyFile = {
            file: file,
            format: fileFormat,
            mime: config?.mime || file.type || null,
            name: fileName,
            partial: false,
            range: [],
            role: 'data',
            modality: 'htm',
            url: config?.url || URL.createObjectURL(file),
        } as StudyContextFile
        this._study.files.push(studyFile)
        return studyFile
    }

    // eslint-disable-next-line @typescript-eslint/require-await -- the importer contract returns a promise.
    async importUrl (source: string | StudyFileContext, config?: ConfigReadFile) {
        const url = (source as StudyFileContext).url || source as string
        Log.debug(`Loading HTM from url ${url}.`, SCOPE)
        const fileName = config?.name || url.split('/').pop() || ''
        const fileFormat = config?.format ? config.format
                            : fileName.endsWith('.htm') || fileName.endsWith('.html')
                                ? 'html'
                                : fileName.endsWith('.md') || fileName.endsWith('.markdown')
                                    ? 'markdown' : this._format
        const studyFile = {
            file: null,
            format: fileFormat,
            mime: config?.mime || null,
            name: config?.name || fileName || '',
            partial: false,
            range: [],
            role: 'data',
            modality: 'htm',
            url: url,
        } as StudyContextFile
        this._study.files.push(studyFile)
        return studyFile
    }
}
