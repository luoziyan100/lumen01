import assert from 'node:assert/strict'
import test from 'node:test'

import { trimHistory } from '../src/agent/history-window.ts'
import type { AgentMessage } from '../src/agent/adapters/types.ts'

function message(role: AgentMessage['role'], content: string, id?: string): AgentMessage {
  return role === 'tool_result'
    ? { role, content, toolCallId: id ?? content }
    : { role, content }
}

test('trimHistory returns unchanged history when inside message window', () => {
  const history = [
    message('user', 'hello'),
    message('assistant', 'hi'),
    message('tool_result', 'short result', 'tool-1'),
  ]

  assert.deepEqual(trimHistory(history, { maxMessages: 5, maxToolResults: 5, preserveLatestN: 2 }), history)
})

test('trimHistory removes oldest user and assistant messages before deleting tool results', () => {
  const history = [
    message('user', 'u1'),
    message('assistant', 'a1'),
    message('tool_result', 'tool memory 1', 'tool-1'),
    message('user', 'u2'),
    message('assistant', 'a2'),
    message('user', 'u3'),
    message('assistant', 'a3'),
  ]

  const trimmed = trimHistory(history, { maxMessages: 4, maxToolResults: 10, preserveLatestN: 2 })

  assert.deepEqual(trimmed.map((entry) => entry.content), [
    'tool memory 1',
    'u3',
    'a3',
  ])
})

test('trimHistory preserves latest messages fully while truncating older tool results', () => {
  const longOlderTool = 'x'.repeat(650)
  const latestTool = 'y'.repeat(650)
  const trimmed = trimHistory([
    message('tool_result', longOlderTool, 'old-tool'),
    message('tool_result', 'second old tool', 'old-tool-2'),
    message('user', 'latest question'),
    message('tool_result', latestTool, 'latest-tool'),
  ], { maxMessages: 10, maxToolResults: 1, preserveLatestN: 2 })

  assert.equal(trimmed[0].content.length, 514)
  assert.equal(trimmed[0].content.endsWith('...[truncated]'), true)
  assert.equal(trimmed[3].content, latestTool)
})

test('trimHistory never deletes system messages', () => {
  const trimmed = trimHistory([
    message('system', 'system prompt'),
    message('user', 'u1'),
    message('assistant', 'a1'),
    message('user', 'u2'),
    message('assistant', 'a2'),
  ], { maxMessages: 1, maxToolResults: 0, preserveLatestN: 1 })

  assert.equal(trimmed[0].role, 'system')
  assert.equal(trimmed[0].content, 'system prompt')
  assert.deepEqual(trimmed.slice(1).map((entry) => entry.content), ['a2'])
})
