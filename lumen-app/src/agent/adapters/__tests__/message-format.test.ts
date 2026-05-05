import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildClaudeRequest,
  parseClaudeResponse,
} from '../claude.ts'
import {
  buildOpenAIRequest,
  parseOpenAIResponse,
} from '../openai.ts'
import {
  buildReActMessages,
  parseReActResponse,
} from '../react-fallback.ts'
import type { AgentMessage, ToolDefinition } from '../types.ts'

const tools: ToolDefinition[] = [
  {
    name: 'academic_search',
    description: 'Search academic papers.',
    parameters: {
      type: 'object',
      properties: {
        queries: { type: 'array', items: { type: 'string' } },
      },
      required: ['queries'],
    },
  },
]

const conversation: AgentMessage[] = [
  { role: 'system', content: 'You are Lumen.' },
  { role: 'user', content: 'Search LLM papers.' },
  {
    role: 'assistant',
    content: '',
    toolCalls: [
      { id: 'toolu_1', name: 'academic_search', arguments: { queries: ['LLM'] } },
    ],
  },
  { role: 'tool_result', toolCallId: 'toolu_1', content: '{"results":[{"title":"Paper A"}]}' },
  { role: 'assistant', content: 'Found Paper A.' },
]

test('Claude adapter converts tool_use and tool_result messages to Anthropic format', () => {
  const request = buildClaudeRequest(conversation, tools, 'claude-sonnet-4-20250514')

  assert.equal(request.model, 'claude-sonnet-4-20250514')
  assert.equal(request.system, 'You are Lumen.')
  assert.deepEqual(request.tools, [
    {
      name: 'academic_search',
      description: 'Search academic papers.',
      input_schema: tools[0].parameters,
    },
  ])
  assert.deepEqual(request.messages, [
    { role: 'user', content: 'Search LLM papers.' },
    {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'toolu_1', name: 'academic_search', input: { queries: ['LLM'] } },
      ],
    },
    {
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'toolu_1', content: '{"results":[{"title":"Paper A"}]}' },
      ],
    },
    { role: 'assistant', content: 'Found Paper A.' },
  ])
})

test('Claude adapter parses mixed text and tool_use content blocks', () => {
  const parsed = parseClaudeResponse({
    content: [
      { type: 'text', text: 'I will search.' },
      { type: 'tool_use', id: 'toolu_2', name: 'academic_search', input: { queries: ['attention'] } },
    ],
  })

  assert.equal(parsed.text, 'I will search.')
  assert.deepEqual(parsed.toolCalls, [
    { id: 'toolu_2', name: 'academic_search', arguments: { queries: ['attention'] } },
  ])
  assert.deepEqual(parsed.message, {
    role: 'assistant',
    content: 'I will search.',
    toolCalls: [
      { id: 'toolu_2', name: 'academic_search', arguments: { queries: ['attention'] } },
    ],
  })
})

test('OpenAI adapter converts tool calls and tool results to Chat Completions format', () => {
  const request = buildOpenAIRequest(conversation, tools, 'gpt-5.5')

  assert.equal(request.model, 'gpt-5.5')
  assert.deepEqual(request.tools, [
    {
      type: 'function',
      function: {
        name: 'academic_search',
        description: 'Search academic papers.',
        parameters: tools[0].parameters,
      },
    },
  ])
  assert.deepEqual(request.messages, [
    { role: 'system', content: 'You are Lumen.' },
    { role: 'user', content: 'Search LLM papers.' },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'toolu_1',
          type: 'function',
          function: { name: 'academic_search', arguments: '{"queries":["LLM"]}' },
        },
      ],
    },
    { role: 'tool', tool_call_id: 'toolu_1', content: '{"results":[{"title":"Paper A"}]}' },
    { role: 'assistant', content: 'Found Paper A.' },
  ])
})

test('OpenAI adapter parses function-call arguments from JSON strings', () => {
  const parsed = parseOpenAIResponse({
    choices: [
      {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_1',
              type: 'function',
              function: {
                name: 'academic_search',
                arguments: '{"queries":["memory augmented LLM"]}',
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      },
    ],
  })

  assert.equal(parsed.text, undefined)
  assert.deepEqual(parsed.toolCalls, [
    { id: 'call_1', name: 'academic_search', arguments: { queries: ['memory augmented LLM'] } },
  ])
  assert.deepEqual(parsed.message, {
    role: 'assistant',
    content: '',
    toolCalls: [
      { id: 'call_1', name: 'academic_search', arguments: { queries: ['memory augmented LLM'] } },
    ],
  })
})

test('ReAct fallback injects tool instructions and parses tool_call blocks', () => {
  const messages = buildReActMessages([
    { role: 'system', content: 'You are Lumen.' },
    { role: 'user', content: 'Find papers.' },
    { role: 'tool_result', toolCallId: 'react_1', content: '{"ok":true}' },
  ], tools)

  assert.equal(messages[0].role, 'system')
  assert.match(messages[0].content, /<tool_call>/)
  assert.match(messages[0].content, /academic_search: Search academic papers\./)
  assert.deepEqual(messages.slice(1), [
    { role: 'user', content: 'Find papers.' },
    { role: 'user', content: 'Observation for react_1:\n{"ok":true}' },
  ])

  const parsed = parseReActResponse('<tool_call>\n{"name":"academic_search","arguments":{"queries":["LLM"]}}\n</tool_call>', 'react_fixed')
  assert.deepEqual(parsed.toolCalls, [
    { id: 'react_fixed', name: 'academic_search', arguments: { queries: ['LLM'] } },
  ])
  assert.equal(parsed.text, undefined)
})

test('ReAct fallback treats ordinary or malformed tool text as final text', () => {
  assert.deepEqual(parseReActResponse('Plain answer.').message, {
    role: 'assistant',
    content: 'Plain answer.',
  })

  assert.deepEqual(parseReActResponse('<tool_call>{"name":</tool_call>').message, {
    role: 'assistant',
    content: '<tool_call>{"name":</tool_call>',
  })
})
