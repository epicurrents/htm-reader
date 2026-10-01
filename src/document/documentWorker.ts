/**
 * Epicurrents document worker body, shared by the format workers.
 *
 * Parsing runs in a worker because a maliciously formatted source can hang the thread that parses
 * it, and the main thread is the one drawing the application.
 *
 * Nothing here imports the core barrel. A worker is inlined into the bundle as a source string, so
 * its weight is paid by every consumer whether or not it ever runs, and reaching for core's settings
 * singleton bundles all of core to carry a value no document processor reads.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type WorkerMessage } from '@epicurrents/core/types'
import type DocumentProcessor from '#document/DocumentProcessor'
import { handleDocumentCommission } from '#document/documentCommissions'
import { Log } from 'scoped-event-log'

/**
 * Build the `onmessage` handler for a document worker.
 * @param processor - Processor serving this worker's commissions.
 * @param scope - Logging scope of the worker.
 * @returns A handler to assign to the worker's `onmessage`.
 */
export const documentWorkerHandler = (processor: DocumentProcessor, scope: string) => {
    return async (message: WorkerMessage) => {
        if (!message?.data?.action) {
            return
        }
        const action = message.data.action
        Log.debug(`Received message with action ${action}.`, scope)
        if (await handleDocumentCommission(message.data, processor, postMessage, scope)) {
            return
        }
        if (action === 'update-settings') {
            // Acknowledged and not applied: reading a document depends on no application setting, so
            // this worker holds none to update. A processor that comes to need one takes it from the
            // snapshot this message carries, rather than from a settings singleton of its own — a
            // worker's copy is written by the relay either way, and the singleton costs the whole
            // core bundle to hold it.
            postMessage({
                action,
                success: true,
                rn: message.data.rn,
            })
            return
        }
        // A worker that posts nothing leaves the caller's commission pending forever. An action this
        // reader does not implement is a failure it has to state, not one the caller waits out.
        Log.warn(`'${action}' is not implemented in this document worker.`, scope)
        postMessage({
            action,
            error: `Action '${action}' is not implemented.`,
            success: false,
            rn: message.data.rn,
        })
    }
}
