/**
 * Epicurrents Markdown processor. Contains the format-specific part of reading a Markdown document;
 * everything shared with the other formats is in {@link DocumentProcessor}.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import DocumentProcessor from '#document/DocumentProcessor'
import markdownit from 'markdown-it'

/**
 * Markdown-it with raw HTML left disabled, which is its default. An HTML fragment embedded in the
 * source is escaped into visible text rather than passed through, so this renderer cannot emit
 * markup the source did not describe as Markdown. The HTML processor has no such property, which is
 * why sanitizing on display is the consumer's obligation either way.
 */
const md = markdownit({
    xhtmlOut: true,
})

export default class MarkdownProcessor extends DocumentProcessor {
    protected _render (raw: string) {
        return md.render(raw)
    }
}
