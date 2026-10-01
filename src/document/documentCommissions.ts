/**
 * Epicurrents document commission handling, shared by the workers and their main-thread
 * substitutes.
 *
 * The two answer the same commissions and differ only in how a reply leaves them, so both delegate
 * here rather than implementing the contract twice. This is the only copy, deliberately: a
 * substitute stands in for a worker precisely where the worker cannot run, so the two are rarely
 * exercised together, and a disagreement between them shows up as a format that behaves differently
 * depending on whether the deployment could start a worker.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { type WorkerMessage } from '@epicurrents/core/types'
import { validateCommissionProps } from '@epicurrents/core/util'
import { type HtmSourceFileContext } from '#types'
import type DocumentProcessor from '#document/DocumentProcessor'
import { asError } from '#util'
import { Log } from 'scoped-event-log'

/** Reply channel: a worker's `postMessage`, or a substitute's `returnMessage`. */
export type CommissionReply = (message: WorkerMessage['data']) => void

/**
 * Handle a document commission, if it is one this contract covers.
 *
 * Every exit replies exactly once, including the failures: an unsettled commission leaves the
 * caller's promise pending forever, which is indistinguishable from a document that is still
 * loading. The property validator is given the same reply channel for that reason — left to its
 * default it posts to the global scope, which is the worker's own reply channel inside a worker and
 * the window inside a substitute.
 * @param message - Data part of the received message.
 * @param processor - Processor to serve the commission from.
 * @param reply - Channel to answer on.
 * @param scope - Logging scope of the caller.
 * @returns True when the commission was handled, false when the caller should handle it itself.
 */
export const handleDocumentCommission = async (
    message: WorkerMessage['data'],
    processor: DocumentProcessor,
    reply: CommissionReply,
    scope: string,
): Promise<boolean> => {
    const action = message.action
    if (action === 'get-page-content') {
        const data = validateCommissionProps(
            message as WorkerMessage['data'] & { pageNum: number },
            {
                // The page number the document module sends. A page a reader cannot resolve is an
                // empty page rather than a failure, so the property itself is optional.
                pageNum: 'Number?',
            },
            true,
            reply,
        )
        if (!data) {
            return true
        }
        try {
            reply({
                action,
                content: await processor.getPageContent(data.pageNum),
                success: true,
                rn: message.rn,
            })
        } catch (e: unknown) {
            Log.error(`Getting the content of a document page failed.`, scope, asError(e))
            reply({
                action,
                error: `Getting the content of a document page failed.`,
                success: false,
                rn: message.rn,
            })
        }
        return true
    } else if (action === 'set-sources') {
        const data = validateCommissionProps(
            message as WorkerMessage['data'] & { sources: HtmSourceFileContext[] },
            {
                // An array even for a single-page document. The processor's own setter takes one
                // source or many, but the validator matches a single constructor, so the commission
                // names the shape it can actually check.
                sources: 'Array',
            },
            true,
            reply,
        )
        if (!data) {
            return true
        }
        try {
            processor.setSources(data.sources)
            reply({
                action,
                // Read back from the processor, which normalizes a lone source into an array, so the
                // count cannot disagree with the sources the lookup will search.
                numPages: processor.numPages,
                success: true,
                rn: message.rn,
            })
        } catch (e: unknown) {
            Log.error(`Setting the document sources failed.`, scope, asError(e))
            reply({
                action,
                error: `Setting the document sources failed.`,
                success: false,
                rn: message.rn,
            })
        }
        return true
    }
    return false
}
