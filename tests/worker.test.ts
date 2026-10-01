/**
 * Tests for the worker body, and for the parity between a worker and its main-thread substitute.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import { type WorkerMessage } from '@epicurrents/core/types'
import HtmlProcessor from '../src/html/HtmlProcessor'
import HtmlWorkerSubstitute from '../src/html/HtmlWorkerSubstitute'
import MarkdownWorkerSubstitute from '../src/markdown/MarkdownWorkerSubstitute'
import { documentWorkerHandler } from '../src/document/documentWorker'
import { fileSource } from './sources'

const SCOPE = 'test.worker'

/** Drive the worker body with a message, collecting what it posts. */
const inWorker = async (messages: Record<string, unknown>[], processor = new HtmlProcessor()) => {
    const posted = [] as WorkerMessage['data'][]
    vi.stubGlobal('postMessage', (reply: WorkerMessage['data']) => posted.push(reply))
    const handler = documentWorkerHandler(processor, SCOPE)
    for (const message of messages) {
        await handler({ data: message } as WorkerMessage)
    }
    return posted
}

/** Drive a substitute with the same messages, collecting what it returns. */
const inSubstitute = async (messages: Record<string, unknown>[], substitute = new HtmlWorkerSubstitute()) => {
    const posted = [] as WorkerMessage['data'][]
    substitute.onmessage = (message: Pick<WorkerMessage, 'data'>) => posted.push(message.data)
    for (const message of messages) {
        await substitute.postMessage(message as WorkerMessage['data'])
    }
    return posted
}

const threeSources = [1, 2, 3].map(page => fileSource(page, `page ${page}`))

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('the worker body', () => {
    test('a message with no action is ignored rather than answered', async () => {
        expect(await inWorker([{ rn: 1 }, {}])).toHaveLength(0)
    })

    test.each(['get-page', 'get-document'])(
        '%s is answered with a failure rather than dropped', async (action) => {
            // A worker that posts nothing leaves the caller's promise pending forever, which reads as
            // a document still loading rather than as a reader that cannot serve the request.
            const posted = await inWorker([{ action, pageNum: 1, rn: 3 }])
            expect(posted).toHaveLength(1)
            expect(posted[0]).toMatchObject({ action, success: false, rn: 3 })
            expect(posted[0].error).toBeTruthy()
        }
    )

    test('an unrecognized action is answered with a failure naming it', async () => {
        const posted = await inWorker([{ action: 'summon-a-daemon', rn: 4 }])
        expect(posted).toHaveLength(1)
        expect(posted[0].success).toBe(false)
        expect(posted[0].error).toContain('summon-a-daemon')
    })

    test('a settings snapshot is acknowledged', async () => {
        const posted = await inWorker([{ action: 'update-settings', settings: { app: {}, modules: {} }, rn: 5 }])
        expect(posted).toHaveLength(1)
        expect(posted[0]).toMatchObject({ action: 'update-settings', success: true, rn: 5 })
    })

    test('the document commissions are served through to the processor', async () => {
        const posted = await inWorker([
            { action: 'set-sources', sources: threeSources, rn: 6 },
            { action: 'get-page-content', pageNum: 2, rn: 7 },
        ])
        expect(posted).toHaveLength(2)
        expect(posted[0]).toMatchObject({ numPages: 3, success: true, rn: 6 })
        expect(posted[1]).toMatchObject({ content: 'page 2', success: true, rn: 7 })
    })

    test('every reply carries the request number it answers', async () => {
        const posted = await inWorker([
            { action: 'set-sources', sources: threeSources, rn: 100 },
            { action: 'get-page-content', pageNum: 1, rn: 101 },
            { action: 'get-page-content', pageNum: 99, rn: 102 },
            { action: 'get-page', rn: 103 },
        ])
        expect(posted.map(reply => reply.rn)).toEqual([100, 101, 102, 103])
    })
})

describe('a substitute needs no application runtime', () => {
    test.each([
        ['html', () => new HtmlWorkerSubstitute()],
        ['markdown', () => new MarkdownWorkerSubstitute()],
    ])('the %s substitute constructs with no runtime global installed', (_format, construct) => {
        // Reading settings off the runtime global was the only thing these needed it for, and no
        // document processor reads a setting.
        expect(window.__EPICURRENTS__).toBeUndefined()
        expect(construct()).toBeDefined()
    })
})

describe('worker and substitute answer alike', () => {
    // A worker and a substitute are two ways of serving one contract, and a deployment runs one or
    // the other, never both — so nothing else would notice them drifting apart.
    const script = [
        { action: 'set-sources', sources: threeSources, rn: 1 },
        { action: 'get-page-content', pageNum: 1, rn: 2 },
        { action: 'get-page-content', pageNum: 3, rn: 3 },
        { action: 'get-page-content', rn: 4 },
        { action: 'get-page-content', pageNum: 42, rn: 5 },
        { action: 'get-page-content', pageNum: 'three', rn: 6 },
        { action: 'set-sources', rn: 7 },
    ]

    test('the same commissions produce the same replies', async () => {
        const fromWorker = await inWorker(script)
        const fromSubstitute = await inSubstitute(script)
        const shape = (replies: WorkerMessage['data'][]) => replies.map(reply => ({
            action: reply.action,
            content: reply.content,
            numPages: reply.numPages,
            success: reply.success,
            rn: reply.rn,
        }))
        expect(shape(fromSubstitute)).toEqual(shape(fromWorker))
        // Agreement alone would also be satisfied by two identically broken implementations, so the
        // script's answers are pinned here too.
        expect(shape(fromWorker)).toEqual([
            { action: 'set-sources', content: undefined, numPages: 3, success: true, rn: 1 },
            { action: 'get-page-content', content: 'page 1', numPages: undefined, success: true, rn: 2 },
            { action: 'get-page-content', content: 'page 3', numPages: undefined, success: true, rn: 3 },
            { action: 'get-page-content', content: 'page 1', numPages: undefined, success: true, rn: 4 },
            { action: 'get-page-content', content: '', numPages: undefined, success: true, rn: 5 },
            { action: 'get-page-content', content: undefined, numPages: undefined, success: false, rn: 6 },
            { action: 'set-sources', content: undefined, numPages: undefined, success: false, rn: 7 },
        ])
    })

    test('each commission is answered exactly once by both', async () => {
        expect(await inWorker(script)).toHaveLength(script.length)
        expect(await inSubstitute(script)).toHaveLength(script.length)
    })

    test('neither posts a validation failure to the global scope', async () => {
        // A substitute runs on the main thread, where the global postMessage is the window's.
        const globalPost = vi.fn()
        vi.stubGlobal('postMessage', globalPost)
        await inSubstitute([{ action: 'get-page-content', pageNum: 'nope', rn: 1 }])
        expect(globalPost).not.toHaveBeenCalled()
    })
})

describe('the substitute body', () => {
    test('a message with no action is ignored rather than answered', async () => {
        expect(await inSubstitute([{ rn: 1 }, {}])).toHaveLength(0)
    })

    test('an action outside this contract is settled by core rather than dropped', async () => {
        // Core's substitute answers an unimplemented action with a failure, which is why the
        // fall-through is a handoff rather than a silent return.
        const posted = await inSubstitute([{ action: 'get-document', rn: 2 }])
        expect(posted).toHaveLength(1)
        expect(posted[0]).toMatchObject({ action: 'get-document', success: false, rn: 2 })
    })

    test('a settings snapshot is acknowledged by core', async () => {
        const posted = await inSubstitute([{ action: 'update-settings', settings: {}, rn: 3 }])
        expect(posted).toHaveLength(1)
        expect(posted[0]).toMatchObject({ action: 'update-settings', success: true, rn: 3 })
    })

    test('a processor rejecting with a value that is not an error is still answered', async () => {
        const processor = new HtmlProcessor()
        processor.setSources(fileSource(1, 'a'))
        vi.spyOn(processor, 'getPageContent').mockRejectedValue('a bare string')
        const substitute = new HtmlWorkerSubstitute()
        Object.assign(substitute, { _reader: processor })
        const posted = await inSubstitute([{ action: 'get-page-content', pageNum: 1, rn: 4 }], substitute)
        expect(posted).toHaveLength(1)
        expect(posted[0]).toMatchObject({ success: false, rn: 4 })
    })
})
