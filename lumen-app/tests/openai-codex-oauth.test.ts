import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildCodexResponsesPayload,
  callCodexResponsesWithProfiles,
  parseCodexResponsesSse,
  selectOpenClawCodexProfile,
} from '../vite.config.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const aiServiceSource = readFileSync(`${root}/src/services/ai.ts`, 'utf8')
const settingsPageSource = readFileSync(`${root}/src/pages/SettingsPage.tsx`, 'utf8')

test('openai-codex provider is available without requiring an API key', () => {
  assert.match(aiServiceSource, /id:\s*'openai-codex'/)
  assert.match(aiServiceSource, /OpenAI GPT OAuth/)
  assert.match(aiServiceSource, /config\.provider !== 'openai-codex' && !config\.api_key/)
  assert.match(aiServiceSource, /OpenAI Codex OAuth 暂只支持本地 dev server 测试/)
})

test('agent role options are applied for non-DeepSeek providers too', () => {
  assert.match(aiServiceSource, /const roleOptions = AGENT_ROLE_OPTIONS\[role\]/)
  assert.match(aiServiceSource, /provider:\s*config\.provider/)
  assert.doesNotMatch(aiServiceSource, /return chatWithAI\(messages, undefined, signal\)/)
})

test('settings page treats openai-codex API key field as an optional profile selector', () => {
  assert.match(settingsPageSource, /配置 AI 提供商的连接方式和默认模型/)
  assert.match(settingsPageSource, /OpenClaw Profile（可选，不是 API Key）/)
  assert.match(settingsPageSource, /留空使用默认已授权的 openai-codex profile/)
  assert.match(settingsPageSource, /type=\{provider === 'openai-codex' \? 'text' : 'password'\}/)
  assert.match(settingsPageSource, /disabled=\{saving \|\| \(provider !== 'openai-codex' && !apiKey\.trim\(\)\)\}/)
  assert.match(settingsPageSource, /openclaw models auth login --provider openai-codex/)
})

test('selectOpenClawCodexProfile chooses usable profiles by default, exact id, or email', () => {
  const profiles = [
    { id: 'openai-codex:expired@example.com', provider: 'openai-codex', type: 'oauth', email: 'expired@example.com', access: 'expired-token', expires: '2020-01-01T00:00:00.000Z' },
    { id: 'openai-codex:first@example.com', provider: 'openai-codex', type: 'oauth', email: 'first@example.com', access: 'first-token', expires: '2099-01-01T00:00:00.000Z' },
    { id: 'openai-codex:second@example.com', provider: 'openai-codex', type: 'oauth', email: 'second@example.com', access: 'second-token' },
    { id: 'openai-codex:no-email-field@example.com', provider: 'openai-codex', type: 'oauth', access: 'id-email-token' },
    { id: 'openai:platform', provider: 'openai', type: 'api_key', access: 'wrong-provider' },
  ]

  assert.equal(selectOpenClawCodexProfile(profiles, '', new Date('2026-05-05T00:00:00.000Z')).access, 'first-token')
  assert.equal(selectOpenClawCodexProfile(profiles, 'openai-codex:second@example.com', new Date('2026-05-05T00:00:00.000Z')).access, 'second-token')
  assert.equal(selectOpenClawCodexProfile(profiles, 'second@example.com', new Date('2026-05-05T00:00:00.000Z')).id, 'openai-codex:second@example.com')
  assert.equal(selectOpenClawCodexProfile(profiles, 'no-email-field@example.com', new Date('2026-05-05T00:00:00.000Z')).access, 'id-email-token')
  assert.throws(
    () => selectOpenClawCodexProfile(profiles, 'expired@example.com', new Date('2026-05-05T00:00:00.000Z')),
    /No usable OpenClaw openai-codex OAuth profile found/,
  )
})

test('buildCodexResponsesPayload creates the required Responses body and omits rejected fields', () => {
  const payload = buildCodexResponsesPayload({
    provider: 'openai-codex',
    model: '',
    maxTokens: 1200,
    responseFormat: 'json',
    messages: [
      { role: 'system', content: 'System A.' },
      { role: 'system', content: 'System B.' },
      { role: 'user', content: 'Return {"ok": true}' },
      { role: 'assistant', content: 'Previous answer' },
    ],
  })

  assert.equal(payload.model, 'gpt-5.5')
  assert.equal(payload.stream, true)
  assert.equal(payload.store, false)
  assert.deepEqual(payload.reasoning, { effort: 'none' })
  assert.match(payload.instructions, /System A\.\n\nSystem B\./)
  assert.match(payload.instructions, /Return a single valid JSON object only/)
  assert.deepEqual(payload.input, [
    { role: 'user', content: [{ type: 'input_text', text: 'Return {"ok": true}' }] },
    { role: 'assistant', content: [{ type: 'input_text', text: 'Previous answer' }] },
  ])
  assert.equal(Object.hasOwn(payload, 'max_output_tokens'), false)
})

test('buildCodexResponsesPayload rejects image inputs clearly', () => {
  assert.throws(
    () => buildCodexResponsesPayload({
      provider: 'openai-codex',
      messages: [{ role: 'user', content: 'describe this', images: [{ mediaType: 'image/png', base64: 'abc' }] }],
    }),
    /openai-codex dev proxy does not support image inputs yet/,
  )
})

test('parseCodexResponsesSse prefers output_text deltas and falls back to done text', () => {
  const deltaStream = [
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"po"}',
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"ng"}',
    'event: response.output_text.done\ndata: {"type":"response.output_text.done","text":"pong from done"}',
    'event: response.completed\ndata: {"type":"response.completed"}',
  ].join('\n\n')

  const doneOnlyStream = 'event: response.output_text.done\ndata: {"type":"response.output_text.done","text":"done text"}'

  assert.equal(parseCodexResponsesSse(deltaStream), 'pong')
  assert.equal(parseCodexResponsesSse(doneOnlyStream), 'done text')
})

test('callCodexResponsesWithProfiles retries the next default profile after usage limit', async () => {
  const authorizations: string[] = []
  const response = await callCodexResponsesWithProfiles({
    provider: 'openai-codex',
    model: 'gpt-5.5',
    messages: [{ role: 'user', content: 'Say exactly: pong' }],
  }, [
    { id: 'openai-codex:limited@example.com', provider: 'openai-codex', type: 'oauth', access: 'limited-token' },
    { id: 'openai-codex:usable@example.com', provider: 'openai-codex', type: 'oauth', access: 'usable-token' },
  ], '', async (_url, init) => {
    authorizations.push(String(init.headers?.Authorization ?? ''))
    if (authorizations.length === 1) {
      return new Response(JSON.stringify({ error: { type: 'usage_limit_reached', message: 'The usage limit has been reached' } }), { status: 429 })
    }
    return new Response('data: {"type":"response.output_text.delta","delta":"pong"}\n\n', { status: 200 })
  })

  assert.equal(response, 'pong')
  assert.deepEqual(authorizations, ['Bearer limited-token', 'Bearer usable-token'])
})

test('callCodexResponsesWithProfiles does not fallback when profile selector is explicit', async () => {
  await assert.rejects(
    () => callCodexResponsesWithProfiles({
      provider: 'openai-codex',
      model: 'gpt-5.5',
      messages: [{ role: 'user', content: 'Say exactly: pong' }],
    }, [
      { id: 'openai-codex:limited@example.com', provider: 'openai-codex', type: 'oauth', access: 'limited-token' },
      { id: 'openai-codex:usable@example.com', provider: 'openai-codex', type: 'oauth', access: 'usable-token' },
    ], 'openai-codex:limited@example.com', async () => (
      new Response(JSON.stringify({ error: { type: 'usage_limit_reached', message: 'The usage limit has been reached' } }), { status: 429 })
    )),
    /usage_limit_reached/,
  )
})
