/**
 * Epicurrents HTML worker substitute. Allows using the HTML reader in the main thread without an
 * actual worker.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import DocumentWorkerSubstitute from '#document/DocumentWorkerSubstitute'
import HtmlProcessor from '#html/HtmlProcessor'

const SCOPE = 'HtmlWorkerSubstitute'

export default class HtmlWorkerSubstitute extends DocumentWorkerSubstitute {
    constructor () {
        super(new HtmlProcessor(), SCOPE)
    }
}
