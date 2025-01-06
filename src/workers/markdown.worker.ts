/**
 * Epicurrents Markdown document worker. Due to risk of maliciously formatted markdown hanging up the main thread,
 * parsing is best performed in a worker.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { SETTINGS } from '@epicurrents/core'
import { type WorkerMessage } from '@epicurrents/core/dist/types'
import { validateCommissionProps } from '@epicurrents/core/dist/util'
import { type HtmSourceFileContext } from '#types'
import MarkdownProcesser from '../markdown/MarkdownProcesser'
import { Log } from 'scoped-event-log'

const SCOPE = "markdown.worker"

const LOADER = new MarkdownProcesser(SETTINGS)

onmessage = async (message: WorkerMessage) => {
    if (!message?.data?.action) {
        return
    }
    const action = message.data.action
    Log.debug(`Received message with action ${action}.`, SCOPE)
    if (action === 'get-page-content') {
        const data = validateCommissionProps(
            message.data as WorkerMessage['data'] & { page: number },
            {
                page: ['Number', 'undefined'],
            }
        )
        if (!data) {
            Log.error(`Validating props for task '${action}' failed.`, SCOPE)
            postMessage({
                action,
                success: false,
                rn: message.data.rn,
            })
            return
        }
        try {
            getPageContent(data.page)
        } catch (e) {
            Log.error(
                `An error occurred while trying to cache signals, operation was aborted.`,
            SCOPE, e as Error)
        }
    } else if (action === 'set-sources') {
        const data = validateCommissionProps(
            message.data as WorkerMessage['data'] & { sources: HtmSourceFileContext | HtmSourceFileContext[] },
            {
                sources: ['Array', 'Object'],
            }
        )
        if (!data) {
            Log.error(`Validating props for task '${action}' failed.`, SCOPE)
            postMessage({
                action,
                success: false,
                rn: message.data.rn,
            })
            return
        }
        try {
            setSources(data.sources)
            postMessage({
                action,
                numPages: Array.isArray(data.sources) ? data.sources.length : 1,
                success: true,
                rn: message.data.rn,
            })
        } catch (e) {
            Log.error(`An error occurred while trying to set sources.`, SCOPE, e as Error)
            postMessage({
                action,
                success: false,
                rn: message.data.rn,
            })
        }
    } else if (action === 'update-settings') {
        Object.assign(SETTINGS, message.data.settings)
    }
}

//const updateCallback = (update: { [prop: string]: unknown }) => {
//}
//LOADER.setUpdateCallback(updateCallback)

/**
 * Get the HTML content of a page.
 * @param page - Page number to get - optional.
 * @returns Parsed page content in HTML.
 */
const getPageContent = (page?: number) => {
    return LOADER.getPageContent(page)
}

const setSources = (sources: HtmSourceFileContext | HtmSourceFileContext[]) => {
    LOADER.setSources(sources)
}