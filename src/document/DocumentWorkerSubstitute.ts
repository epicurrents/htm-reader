/**
 * Epicurrents document worker substitute. Allows using a document reader in the main thread without
 * an actual worker.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { ServiceWorkerSubstitute } from '@epicurrents/core'
import type { WorkerMessage, WorkerSubstitute } from '@epicurrents/core/types'
import type DocumentProcessor from '#document/DocumentProcessor'
import { handleDocumentCommission } from '#document/documentCommissions'
import { Log } from 'scoped-event-log'

export default abstract class DocumentWorkerSubstitute extends ServiceWorkerSubstitute implements WorkerSubstitute {
    protected _reader: DocumentProcessor
    /** Logging scope of the concrete substitute, used for the messages this class emits. */
    protected _scope: string

    /**
     * @param reader - Processor serving this substitute's commissions.
     * @param scope - Logging scope of the concrete substitute.
     */
    constructor (reader: DocumentProcessor, scope: string) {
        super()
        this._reader = reader
        this._scope = scope
    }

    async postMessage (message: WorkerMessage['data']) {
        if (!message?.action) {
            return
        }
        Log.debug(`Received message with action ${message.action}.`, this._scope)
        if (await handleDocumentCommission(message, this._reader, this.returnMessage.bind(this), this._scope)) {
            return
        }
        // Core's substitute handles the settings relay and answers anything else with a failure, so
        // an unhandled action is settled there rather than dropped here.
        await super.postMessage(message)
    }
}
