/**
 * Page-source fixtures. The document module numbers its sources from one, but the reader looks a page
 * up by the `page` property rather than by position, so a fixture can set the two out of step
 * deliberately.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type HtmSourceFileContext } from '../src/types'

/** A source carrying its content as a file. */
export const fileSource = (page: number, content: string, name = `page-${page}.md`): HtmSourceFileContext => {
    return {
        file: new File([content], name, { type: 'text/plain' }),
        page,
        url: null,
    }
}

/** A source carrying only an address. */
export const urlSource = (page: number, url: string): HtmSourceFileContext => {
    return {
        file: null,
        page,
        url,
    }
}

/** A source carrying neither, which is what an incompletely built study file produces. */
export const emptySource = (page: number): HtmSourceFileContext => {
    return {
        file: null,
        page,
        url: null,
    }
}
