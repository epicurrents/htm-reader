/**
 * Epicurrents document processor. Common base of the format processors, holding everything that does
 * not depend on the document's markup language: the page sources, the page lookup and reading a
 * source's bytes. A subclass supplies only {@link DocumentProcessor._render}.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type HtmSourceFileContext } from '#types'
import { asError } from '#util'
import { Log } from 'scoped-event-log'

const SCOPE = 'DocumentProcessor'

export default abstract class DocumentProcessor {
    /** HTM content sources, one per page. */
    protected _sources = [] as HtmSourceFileContext[]
    /**
     * Number of pages the current sources hold. Read straight off the normalized source array, so a
     * single source passed on its own and an array holding it agree.
     */
    get numPages () {
        return this._sources.length
    }

    get sources () {
        return this._sources
    }

    /**
     * Read a source's raw text, from the file if it carries one and from its URL otherwise.
     *
     * Every failure resolves to `null` rather than rejecting: this runs inside a worker's message
     * handler, where a rejection posts no reply at all and leaves the caller's commission unsettled.
     * @param source - Source to read.
     * @returns The source's text, or `null` if it could not be read.
     */
    protected async _readSource (source: HtmSourceFileContext): Promise<string | null> {
        if (source.file) {
            try {
                return await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve((reader.result as string) || '')
                    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed.'))
                    reader.readAsText(source.file as File)
                })
            } catch (e: unknown) {
                Log.error(`Reading document contents from the source file failed.`, SCOPE, asError(e))
                return null
            }
        }
        if (source.url) {
            try {
                const response = await fetch(source.url)
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`)
                }
                return await response.text()
            } catch (e: unknown) {
                Log.error(`Loading document contents from ${source.url} failed.`, SCOPE, asError(e))
                return null
            }
        }
        Log.error(`The requested page had no file or url to load contents from.`, SCOPE)
        return null
    }

    /**
     * Render a source's raw text as the HTML a viewer displays.
     *
     * The result is **not sanitized**. A consumer inserting it into the DOM must sanitize it there;
     * see the format contract in this package's README.
     * @param raw - The source's text as read.
     * @returns Renderable HTML.
     */
    protected abstract _render (raw: string): string

    /**
     * Find the source holding the given page.
     * @param pageNum - Page number to look for; omitted returns the first source.
     * @returns The matching source, or `null` if there is none.
     */
    protected _resolveSource (pageNum?: number): HtmSourceFileContext | null {
        if (!this._sources.length) {
            Log.error(`Cannot get page contents, no page sources have been set.`, SCOPE)
            return null
        }
        if (pageNum === undefined) {
            if (this._sources.length > 1) {
                Log.warn(`Content of a multi-page document requested without a page number, ` +
                         `returning the first page.`, SCOPE)
            }
            return this._sources[0]
        }
        const matching = this._sources.filter(source => source.page === pageNum)
        if (!matching.length) {
            Log.error(`Requested page #${pageNum} was not found.`, SCOPE)
            return null
        }
        if (matching.length > 1) {
            Log.warn(`Multiple pages matched the requested #${pageNum}, returning the first match.`, SCOPE)
        }
        return matching[0]
    }

    /**
     * Get the rendered content of a page.
     * @param pageNum - Number of the page to get (1-based); omitted returns the first page.
     * @returns Rendered HTML, or an empty string if the page could not be read.
     */
    async getPageContent (pageNum?: number) {
        const source = this._resolveSource(pageNum)
        if (!source) {
            return ''
        }
        const raw = await this._readSource(source)
        return raw === null ? '' : this._render(raw)
    }

    /**
     * Set the document's page sources, replacing any previously set.
     * @param sources - A single source or one per page.
     */
    setSources (sources: HtmSourceFileContext | HtmSourceFileContext[]) {
        this._sources = Array.isArray(sources) ? sources : [sources]
    }
}
