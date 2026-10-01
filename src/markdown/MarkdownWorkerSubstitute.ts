/**
 * Epicurrents Markdown worker substitute. Allows using the Markdown reader in the main thread
 * without an actual worker.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import DocumentWorkerSubstitute from '#document/DocumentWorkerSubstitute'
import MarkdownProcessor from '#markdown/MarkdownProcessor'

const SCOPE = 'MarkdownWorkerSubstitute'

export default class MarkdownWorkerSubstitute extends DocumentWorkerSubstitute {
    constructor () {
        super(new MarkdownProcessor(), SCOPE)
    }
}
