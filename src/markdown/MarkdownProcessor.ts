/**
 * Epicurrents Markdown processor. This class contains the common methods used both by workerized and direct readers.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import {
    type AppSettings,
} from '@epicurrents/core/dist/types'
import { type HtmSourceFileContext } from '#types'
import markdownit from 'markdown-it'
import { Log } from 'scoped-event-log'

const SCOPE = 'MarkdownProcesser'

// Configure Markdown-it.
const md = markdownit({
    xhtmlOut: true,
})

export default class MarkdownProcessor {
    /** Parsed HTM content of the source files. */
    protected _htmContent = [] as { content: string, page: number }[]
    /** HTM content sources. */
    protected _sources = [] as HtmSourceFileContext[]
    /** A method to pass update messages through. */
    protected _updateCallback = null as ((update: { [prop: string]: unknown }) => void) | null
    /** Settings must be kept up-to-date with the main application. */
    SETTINGS: AppSettings

    constructor (settings: AppSettings) {
        this.SETTINGS = settings
    }

    get sources () {
        return this._sources
    }

    async getPageContent (pageNum?: number) {
        if (!this._sources.length) {
            Log.error(`Cannot get page contents, no page sources have been set.`, SCOPE)
            return ''
        }
        // Find the requested page.
        if (pageNum) {
            const matchingPages = this._sources.filter(s => s.page === pageNum)
            if (!matchingPages.length) {
                Log.error(`Requested page #${pageNum} was not found.`, SCOPE)
                return ''
            }
            if (matchingPages.length > 1) {
                Log.warn(`Multiple pages matched the requested #${pageNum}, returning the first match.`, SCOPE)
            }
        } else {
            if (this._sources.length > 1) {
                Log.warn(`Multiple page resource requested without a page number, returning the first page.`, SCOPE)
            }
        }
        const requestedPage =  pageNum ? this._sources.filter(s => s.page === pageNum)[0]
                                       : this._sources[0] as HtmSourceFileContext
        if (requestedPage.file) {
            // Use FileReader to get file contents.
            const frPromise = new Promise<string>((resolve, reject) => {
                const fr = new FileReader()
                fr.onload = () => resolve((fr.result as string) || '')
                fr.onerror = reject
                fr.readAsText(requestedPage.file as File)
            })
            try {
                const content = await frPromise
                return md.render(content)
            } catch (e) {
                Log.error(`Reading file markdown file contents failed.`, SCOPE, e as Error)
                return ''
            }
        } else if (requestedPage.url) {
            // Fetch the file contents.
            const content = await fetch(requestedPage.url).then(r => r.text())
            return md.render(content)
        }
        Log.error(`The requested page had no file or url to load contents from.`, SCOPE)
        return ''
    }

    setSources (sources: HtmSourceFileContext | HtmSourceFileContext[]) {
        // Remove previously cache source content.
        if (this._htmContent.length) {
            this._htmContent.splice(0)
        }
        this._sources = Array.isArray(sources) ? sources : [sources]
    }

    /**
     * Set the update callback to get loading updates.
     * @param callback A method that takes the loading update as a parameter.
     */
    setUpdateCallback (callback: ((update: { [prop: string]: unknown }) => void) | null) {
        this._updateCallback = callback
    }
}
