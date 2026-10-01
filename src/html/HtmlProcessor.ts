/**
 * Epicurrents HTML processor. Contains the format-specific part of reading an HTML document;
 * everything shared with the other formats is in {@link DocumentProcessor}.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import DocumentProcessor from '#document/DocumentProcessor'

export default class HtmlProcessor extends DocumentProcessor {
    /**
     * An HTML source is already the markup a viewer displays, so rendering it is reading it.
     *
     * Nothing is stripped here, and nothing should be: this runs in a worker, which has no DOM and
     * therefore no sanitizer worth trusting, and a reader that quietly removed part of a document
     * would be the wrong place to discover it. The consumer sanitizes at the point of insertion.
     */
    protected _render (raw: string) {
        return raw
    }
}
