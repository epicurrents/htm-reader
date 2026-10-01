/**
 * Epicurrents Markdown document worker.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import { documentWorkerHandler } from '#document/documentWorker'
import MarkdownProcessor from '#markdown/MarkdownProcessor'

const SCOPE = 'markdown.worker'

onmessage = documentWorkerHandler(new MarkdownProcessor(), SCOPE)
