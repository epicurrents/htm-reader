/**
 * Epicurrents HTM worker substitute. Allows using the HTM loader in the main thread without an actual worker.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { ServiceWorkerSubstitute } from '@epicurrents/core'
import { validateCommissionProps } from '@epicurrents/core/dist/util'
import { type WorkerMessage } from '@epicurrents/core/dist/types'
import { type HtmSourceFileContext } from '#types'
import MarkdownProcesser from './MarkdownProcesser'
import { Log } from 'scoped-event-log'

const SCOPE = 'MarkdownWorkerSubstitute'

export default class MarkdownWorkerSubstitute extends ServiceWorkerSubstitute {
    protected _reader: MarkdownProcesser
    constructor () {
        super()
        if (!window.__EPICURRENTS__?.RUNTIME) {
            Log.error(`Reference to main application was not found!`, SCOPE)
        }
        this._reader = new MarkdownProcesser(window.__EPICURRENTS__.RUNTIME.SETTINGS)
        //const updateCallback = (update: { [prop: string]: unknown }) => {
        //    if (update.action === 'cache-signals') {
        //        this.returnMessage(update as WorkerMessage['data'])
        //    }
        //}
        //this._reader.setUpdateCallback(updateCallback)
    }
    async postMessage (message: WorkerMessage['data']) {
        if (!message?.action) {
            return
        }
        const action = message.action
        Log.debug(`Received message with action ${action}.`, SCOPE)
        if (action === 'get-page-content') {
            const data = validateCommissionProps(
                message as WorkerMessage['data'] & { pageNum: number },
                {
                    pageNum: ['Number', 'undefined'],
                }
            )
            if (!data) {
                Log.error(`Validating props for task '${action}' failed.`, SCOPE)
                this.returnMessage({
                    action,
                    success: false,
                    rn: message.rn,
                })
                return
            }
            try {
                const content = await this._reader.getPageContent(data.pageNum)
                this.returnMessage({
                    action,
                    content,
                    success: true,
                    rn: message.rn,
                })
            } catch (e) {
                Log.error(`An error occurred while trying to get page content.`, SCOPE, e as Error)
                this.returnMessage({
                    action,
                    success: false,
                    rn: message.rn,
                })
            }
        } else if (action === 'set-sources') {
            const data = validateCommissionProps(
                message as WorkerMessage['data'] & { sources: HtmSourceFileContext | HtmSourceFileContext[] },
                {
                    sources: 'Array',
                }
            )
            if (!data) {
                Log.error(`Validating props for task '${action}' failed.`, SCOPE)
                this.returnMessage({
                    action,
                    success: false,
                    rn: message.rn,
                })
                return
            }
            try {
                this._reader.setSources(data.sources)
                this.returnMessage({
                    action,
                    numPages: Array.isArray(data.sources) ? data.sources.length : 1,
                    success: true,
                    rn: data.rn,
                })
            } catch (e) {
                Log.error(`An error occurred while trying to set sources.`, SCOPE, e as Error)
                this.returnMessage({
                    action,
                    success: false,
                    rn: message.rn,
                })
            }
        } else {
            super.postMessage(message)
        }
    }
}