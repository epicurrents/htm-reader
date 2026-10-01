/**
 * Tests for what each format's processor renders.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, test } from 'vitest'
import HtmlProcessor from '../src/html/HtmlProcessor'
import MarkdownProcessor from '../src/markdown/MarkdownProcessor'
import { fileSource } from './sources'

/** Read one page of content out of a processor holding a single source. */
const render = async (processor: HtmlProcessor | MarkdownProcessor, content: string) => {
    processor.setSources(fileSource(1, content))
    return await processor.getPageContent(1)
}

describe('markdown', () => {
    test('markdown is rendered as HTML', async () => {
        const html = await render(new MarkdownProcessor(), '# Heading\n\nA paragraph with *emphasis*.')
        expect(html).toContain('<h1>Heading</h1>')
        expect(html).toContain('<em>emphasis</em>')
    })

    test('void elements are closed, as the XHTML output option asks', async () => {
        expect(await render(new MarkdownProcessor(), 'one\n\n---\n\ntwo')).toContain('<hr />')
    })

    test('raw HTML in the source is escaped rather than passed through', async () => {
        // Markdown-it leaves raw HTML disabled by default, so this renderer cannot emit markup its
        // source did not describe as Markdown. The HTML processor has no such property, which is why
        // sanitizing on display is the consumer's obligation for both.
        const html = await render(new MarkdownProcessor(), 'before <script>alert(1)</script> after')
        expect(html).not.toContain('<script>')
        expect(html).toContain('&lt;script&gt;')
    })
})

describe('html', () => {
    test('an HTML source is returned as it was read', async () => {
        const source = '<h1>Heading</h1>\n<p>A paragraph.</p>'
        expect(await render(new HtmlProcessor(), source)).toBe(source)
    })

    test('nothing is stripped, including what a consumer must sanitize', async () => {
        // The reader is not the sanitizer: it has no DOM to parse with, and a reader that quietly
        // removed part of a document would be the wrong place to discover it. The viewer sanitizes at
        // the point of insertion, and this test states that the reader relies on it.
        const source = '<p>text</p><script>alert(1)</script>'
        expect(await render(new HtmlProcessor(), source)).toBe(source)
    })
})
