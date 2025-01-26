/**
 * Epicurrents HTM reader.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { GenericFileReader } from '@epicurrents/core'
import {
    type AssociatedFileType,
    type StudyContextFile,
    type StudyFileContext,
} from '@epicurrents/core/dist/types'
import {
    type ConfigReadFile,
    type DocumentFileReader,
    type HtmDocumentFormat,
} from '#types'
import Log from 'scoped-event-log'

const SCOPE = 'HtmReader'

export default class HtmReader extends GenericFileReader implements DocumentFileReader {
    protected _format: HtmDocumentFormat

    constructor (format: HtmDocumentFormat) {
        const fileTypeAssocs = [
            {
                accept: {
                    "text/markdown": ['.md', '.markdown'],
                },
                description: "Markdown",
            },
            {
                accept: {
                    "text/html": ['.htm', '.html'],
                },
                description: "HyperText Markup Language (HTML)",
            },
        ] as AssociatedFileType[]
        super(SCOPE, [], fileTypeAssocs)
        this._format = format
    }

    getFileTypeWorker (): Worker | null {
        if (this._format === 'markdown') {
            const workerOverride = this._workerOverride.get('markdown')
            const worker = workerOverride ? workerOverride() : new Worker(
                /* webpackChunkName: 'markdown.worker' */
                new URL('./workers/markdown.worker', import.meta.url),
                { type: 'module' }
            )
            Log.registerWorker(worker)
            return worker
        } else {
            return null
        }
    }

    async readFile (source: File | StudyFileContext, config?: ConfigReadFile) {
        const file = (source as StudyFileContext).file || source as File
        Log.debug(`Loading HTM from file ${file.webkitRelativePath}.`, SCOPE)
        const fileName = config?.name || file.name || ''
        const fileFormat = config?.format ? config.format
                            : fileName.endsWith('.htm') || fileName.endsWith('.html')
                                ? 'html'
                                : fileName.endsWith('.md') || fileName.endsWith('.markdown')
                                    ? 'markdown' : ''
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

    async readUrl (source: string | StudyFileContext, config?: ConfigReadFile) {
        const url = (source as StudyFileContext).url || source as string
        Log.debug(`Loading HTM from url ${url}.`, SCOPE)
        const fileName = config?.name || url.split('/').pop() || ''
        const fileFormat = config?.format ? config.format
                            : fileName.endsWith('.htm') || fileName.endsWith('.html')
                                ? 'html'
                                : fileName.endsWith('.md') || fileName.endsWith('.markdown')
                                    ? 'markdown' : ''
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
