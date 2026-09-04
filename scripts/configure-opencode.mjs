#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function createModel(name, context = 200000) {
  return {
    name,
    limit: {
      context,
      output: 64000
    },
    modalities: {
      input: ['text', 'image', 'pdf'],
      output: ['text']
    }
  }
}

const BUILTIN_MODELS = {
  auto: createModel('Kiro Auto'),
  'claude-haiku-4-5': createModel('Claude Haiku 4.5'),
  'claude-haiku-4-5-thinking': createModel('Claude Haiku 4.5 Thinking'),
  'claude-sonnet-4-5': createModel('Claude Sonnet 4.5'),
  'claude-sonnet-4-5-thinking': createModel('Claude Sonnet 4.5 Thinking'),
  'claude-sonnet-4-5-1m': createModel('Claude Sonnet 4.5 (1M context)', 1000000),
  'claude-sonnet-4-5-1m-thinking': createModel('Claude Sonnet 4.5 (1M context, thinking)', 1000000),
  'claude-sonnet-4-6': createModel('Claude Sonnet 4.6'),
  'claude-sonnet-4-6-thinking': createModel('Claude Sonnet 4.6 Thinking'),
  'claude-sonnet-4-6-1m': createModel('Claude Sonnet 4.6 (1M context)', 1000000),
  'claude-sonnet-4-6-1m-thinking': createModel('Claude Sonnet 4.6 (1M context, thinking)', 1000000),
  'claude-opus-4-5': createModel('Claude Opus 4.5'),
  'claude-opus-4-5-thinking': createModel('Claude Opus 4.5 Thinking'),
  'claude-opus-4-6': createModel('Claude Opus 4.6'),
  'claude-opus-4-6-thinking': createModel('Claude Opus 4.6 Thinking'),
  'claude-opus-4-6-1m': createModel('Claude Opus 4.6 (1M context)', 1000000),
  'claude-opus-4-6-1m-thinking': createModel('Claude Opus 4.6 (1M context, thinking)', 1000000),
  'claude-opus-4-7': createModel('Claude Opus 4.7'),
  'claude-opus-4-7-thinking': createModel('Claude Opus 4.7 Thinking'),
  'claude-opus-4-7-1m': createModel('Claude Opus 4.7 (1M context)', 1000000),
  'claude-opus-4-7-1m-thinking': createModel('Claude Opus 4.7 (1M context, thinking)', 1000000),
  'claude-opus-4-8': createModel('Claude Opus 4.8'),
  'claude-opus-4-8-thinking': createModel('Claude Opus 4.8 Thinking'),
  'claude-opus-4-8-1m': createModel('Claude Opus 4.8 (1M context)', 1000000),
  'claude-opus-4-8-1m-thinking': createModel('Claude Opus 4.8 (1M context, thinking)', 1000000),
  'claude-sonnet-5': createModel('Claude Sonnet 5', 1000000),
  'claude-sonnet-5-thinking': createModel('Claude Sonnet 5 Thinking', 1000000),
  'claude-sonnet-5-1m': createModel('Claude Sonnet 5 (1M context)', 1000000),
  'claude-sonnet-5-1m-thinking': createModel('Claude Sonnet 5 (1M context, thinking)', 1000000),
  'claude-sonnet-4': createModel('Claude Sonnet 4'),
  'claude-3-7-sonnet': createModel('Claude 3.7 Sonnet'),
  'nova-swe': createModel('Amazon Nova SWE'),
  'gpt-oss-120b': createModel('GPT OSS 120B'),
  'qwen3-coder-480b': createModel('Qwen3 Coder 480B'),
  'minimax-m2': createModel('MiniMax M2'),
  'kimi-k2-thinking': createModel('Kimi K2 Thinking'),
  'gpt-5-6-sol': createModel('GPT-5.6 Sol', 272000),
  'gpt-5-6-terra': createModel('GPT-5.6 Terra', 272000),
  'gpt-5-6-luna': createModel('GPT-5.6 Luna', 272000)
}

function parseArgs(argv) {
  const options = {}

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue

    const key = arg.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      options[key] = true
      continue
    }

    options[key] = value
    i += 1
  }

  return options
}

function stripJsonComments(input) {
  let output = ''
  let inString = false
  let quote = ''
  let escaped = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]

    if (inString) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        inString = false
        quote = ''
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quote = char
      output += char
      continue
    }

    if (char === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i += 1
      if (i < input.length) output += '\n'
      continue
    }

    if (char === '/' && next === '*') {
      i += 2
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1
      i += 1
      continue
    }

    output += char
  }

  return output
}

function stripTrailingCommas(input) {
  let output = ''
  let inString = false
  let quote = ''
  let escaped = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]

    if (inString) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === quote) {
        inString = false
        quote = ''
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quote = char
      output += char
      continue
    }

    if (char === ',') {
      let j = i + 1
      while (j < input.length && /\s/.test(input[j])) j += 1
      if (input[j] === '}' || input[j] === ']') continue
    }

    output += char
  }

  return output
}

function parseJsonc(input) {
  return JSON.parse(stripTrailingCommas(stripJsonComments(input)))
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function cloneModel(model) {
  return JSON.parse(JSON.stringify(model))
}

function print(message) {
  console.log(`[opencode-kiro-oauth] ${message}`)
}

function warn(message) {
  console.warn(`[opencode-kiro-oauth] ${message}`)
}

function getPluginEntries(value) {
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === 'string')
  if (typeof value === 'string' && value.trim()) return [value]
  return []
}

function normalizeMode(value) {
  if (value === 'install' || value === 'build' || value === 'manual') return value
  return 'manual'
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function configureOpencode({ mode, configPath, pluginPath, manualCommand }) {
  if (!existsSync(configPath)) {
    warn(`OpenCode config was not found at ${configPath}.`)
    print(`Install OpenCode first, then run: ${manualCommand}`)
    return false
  }

  let config
  try {
    config = parseJsonc(readFileSync(configPath, 'utf8'))
  } catch (error) {
    warn(`Failed to parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`)
    print(`Update the config manually or rerun after fixing the file: ${manualCommand}`)
    return false
  }

  if (!isRecord(config)) {
    warn(`Expected ${configPath} to contain a JSON object.`)
    print(`Update the config manually or rerun after fixing the file: ${manualCommand}`)
    return false
  }

  let changed = false

  const pluginEntries = getPluginEntries(config.plugin)
  const hadPluginArray = Array.isArray(config.plugin)
  if (!hadPluginArray || pluginEntries.length !== config.plugin.length) {
    changed = true
  }
  config.plugin = pluginEntries

  if (!config.plugin.includes(pluginPath)) {
    config.plugin.push(pluginPath)
    changed = true
  }

  if (config.provider === undefined) {
    config.provider = {}
    changed = true
  }

  if (!isRecord(config.provider)) {
    warn(`Expected "provider" in ${configPath} to be an object.`)
    print(`Update the config manually or rerun after fixing the file: ${manualCommand}`)
    return false
  }

  if (config.provider.kiro === undefined) {
    config.provider.kiro = {}
    changed = true
  }

  if (!isRecord(config.provider.kiro)) {
    warn(`Expected "provider.kiro" in ${configPath} to be an object.`)
    print(`Update the config manually or rerun after fixing the file: ${manualCommand}`)
    return false
  }

  if (config.provider.kiro.models === undefined) {
    config.provider.kiro.models = {}
    changed = true
  }

  if (!isRecord(config.provider.kiro.models)) {
    warn(`Expected "provider.kiro.models" in ${configPath} to be an object.`)
    print(`Update the config manually or rerun after fixing the file: ${manualCommand}`)
    return false
  }

  for (const [modelId, modelConfig] of Object.entries(BUILTIN_MODELS)) {
    if (isRecord(config.provider.kiro.models[modelId])) continue
    config.provider.kiro.models[modelId] = cloneModel(modelConfig)
    changed = true
  }

  if (!changed) {
    print(`OpenCode config already includes the local plugin: ${pluginPath}`)
    return true
  }

  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  print(`Updated OpenCode config at ${configPath} (${mode}).`)
  return true
}

const args = parseArgs(process.argv.slice(2))
const mode = normalizeMode(args.mode)
const scriptPath = fileURLToPath(import.meta.url)
const scriptDirectory = dirname(scriptPath)
const repoRoot = resolve(scriptDirectory, '..')
const pluginPath = resolve(
  String(args['plugin-path'] || process.env.OPENCODE_PLUGIN_PATH || repoRoot)
)
const configPath = resolve(
  String(
    args['config-path'] ||
      process.env.OPENCODE_CONFIG_PATH ||
      join(homedir(), '.config', 'opencode', 'opencode.json')
  )
)
const manualCommand = String(
  args['manual-command'] || `bun run --cwd ${shellQuote(repoRoot)} configure-opencode`
)

configureOpencode({ mode, configPath, pluginPath, manualCommand })
