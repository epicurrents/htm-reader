/**
 * Tests for the shared document commission contract: what each commission replies, and that every
 * path replies exactly once.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { describe, expect, test, vi } from 'vitest'
import { type WorkerMessage } from '@epicurrents/core/types'
import HtmlProcessor from '../src/html/HtmlProcessor'
import { handleDocumentCommission } from '../src/document/documentCommissions'
import { fileSource } from './sources'

const SCOPE = 'test'

/** Run a commission against a fresh processor, collecting every reply it produces. */
const commission = async (message: Record<string, unknown>, processor = new HtmlProcessor()) => {
    const replies = [] as WorkerMessage['data'][]
    const handled = await handleDocumentCommission(
        message as WorkerMessage['data'], processor, reply => replies.push(reply), SCOPE
    )
    return { handled, processor, replies }
}

/** A processor holding a three-page document, numbered from one. */
const threePages = () => {
    const processor = new HtmlProcessor()
    processor.setSources([1, 2, 3].map(page => fileSource(page, `page ${page}`)))
    return processor
}

describe('get-page-content', () => {
    test('the requested page is the page that comes back', async () => {
        // The page number the document module sends is `pageNum`. Reading it from any other property
        // leaves the number undefined, which serves page one for every page asked for.
        for (const page of [1, 2, 3]) {
            const { replies } = await commission({ action: 'get-page-content', pageNum: page, rn: 7 }, threePages())
            expect(replies).toHaveLength(1)
            expect(replies[0]).toMatchObject({
                action: 'get-page-content', content: `page ${page}`, success: true, rn: 7,
            })
        }
    })

    test('a document of several pages does not answer every request with its first page', async () => {
        const contents = [] as unknown[]
        const processor = threePages()
        for (const page of [1, 2, 3]) {
            const { replies } = await commission({ action: 'get-page-content', pageNum: page, rn: 1 }, processor)
            contents.push(replies[0].content)
        }
        expect(new Set(contents).size).toBe(3)
    })

    test('an omitted page number is accepted and answers with the first page', async () => {
        const { replies } = await commission({ action: 'get-page-content', rn: 2 }, threePages())
        expect(replies).toHaveLength(1)
        expect(replies[0]).toMatchObject({ content: 'page 1', success: true, rn: 2 })
    })

    test('a page that cannot be resolved is empty content rather than a failure', async () => {
        const { replies } = await commission({ action: 'get-page-content', pageNum: 9, rn: 3 }, threePages())
        expect(replies).toHaveLength(1)
        expect(replies[0]).toMatchObject({ content: '', success: true, rn: 3 })
    })

    test('a page number of the wrong type is refused on the given reply channel', async () => {
        // The validator replies itself, on the channel it is handed. Left to its default it posts to
        // the global scope, which is the window when this runs in a substitute.
        const { handled, replies } = await commission({ action: 'get-page-content', pageNum: 'two', rn: 4 })
        expect(handled).toBe(true)
        expect(replies).toHaveLength(1)
        expect(replies[0]).toMatchObject({ success: false, rn: 4 })
        expect(replies[0].error).toBeTruthy()
    })

    test('a processor that throws is answered once, with a failure', async () => {
        const processor = threePages()
        vi.spyOn(processor, 'getPageContent').mockRejectedValue(new Error('parse exploded'))
        const { replies } = await commission({ action: 'get-page-content', pageNum: 1, rn: 5 }, processor)
        expect(replies).toHaveLength(1)
        expect(replies[0]).toMatchObject({ action: 'get-page-content', success: false, rn: 5 })
    })
})

describe('set-sources', () => {
    test('the page count comes back from the sources that were set', async () => {
        const { handled, processor, replies } = await commission({
            action: 'set-sources',
            sources: [fileSource(1, 'a'), fileSource(2, 'b'), fileSource(3, 'c')],
            rn: 8,
        })
        expect(handled).toBe(true)
        expect(replies).toHaveLength(1)
        expect(replies[0]).toMatchObject({ action: 'set-sources', numPages: 3, success: true, rn: 8 })
        expect(processor.numPages).toBe(3)
    })

    test('a single-page document reports one page', async () => {
        const { replies } = await commission({ action: 'set-sources', sources: [fileSource(1, 'a')], rn: 9 })
        expect(replies[0]).toMatchObject({ numPages: 1, success: true })
    })

    test('absent sources are refused once', async () => {
        const { handled, replies } = await commission({ action: 'set-sources', rn: 10 })
        expect(handled).toBe(true)
        expect(replies).toHaveLength(1)
        expect(replies[0]).toMatchObject({ success: false, rn: 10 })
    })

    test('a failing setter is answered once, with a failure', async () => {
        const processor = new HtmlProcessor()
        vi.spyOn(processor, 'setSources').mockImplementation(() => {
            throw new Error('sources rejected')
        })
        const { replies } = await commission(
            { action: 'set-sources', sources: [fileSource(1, 'a')], rn: 11 }, processor
        )
        expect(replies).toHaveLength(1)
        expect(replies[0]).toMatchObject({ action: 'set-sources', success: false, rn: 11 })
    })
})

describe('commissions this contract does not cover', () => {
    test.each(['get-page', 'get-document', 'update-settings', 'nonsense'])(
        '%s is handed back to the caller unanswered', async (action) => {
            const { handled, replies } = await commission({ action, rn: 12 })
            expect(handled).toBe(false)
            expect(replies).toHaveLength(0)
        }
    )
})
