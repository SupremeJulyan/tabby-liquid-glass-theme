import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

function configFile () {
    if (process.env.TABBY_CONFIG_PATH) return process.env.TABBY_CONFIG_PATH
    if (process.env.TABBY_CONFIG_DIR) return join(process.env.TABBY_CONFIG_DIR, 'config.yaml')
    if (process.platform === 'win32') return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'tabby', 'config.yaml')
    if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'tabby', 'config.yaml')
    return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'tabby', 'config.yaml')
}

function section (lines, name) {
    const start = lines.findIndex(line => new RegExp(`^${name}:\\s*(?:#.*)?$`).test(line))
    if (start < 0) return null
    let end = start + 1
    while (end < lines.length && (!lines[end].trim() || /^[ \t]/.test(lines[end]))) end++
    return { start, end, lines: lines.slice(start, end) }
}

function scalar (lines, name) {
    const line = lines.find(value => new RegExp(`^\\s{2}${name}:\\s*`).test(value))
    if (!line) return undefined
    const value = line.replace(new RegExp(`^\\s{2}${name}:\\s*`), '').replace(/\s+#.*$/, '').trim()
    if (value === 'true') return true
    if (value === 'false') return false
    return value.replace(/^(?:'([^']*)'|"([^"]*)")$/, (_, single, double) => single ?? double)
}

function setScalar (lines, name, value) {
    const pattern = new RegExp(`^\\s{2}${name}:\\s*`)
    const index = lines.findIndex(line => pattern.test(line))
    const line = `  ${name}: ${value}`
    if (index >= 0) lines[index] = line
    else lines.splice(1, 0, line)
}

try {
    const path = configFile()
    const original = await readFile(path, 'utf8')
    const newline = original.includes('\r\n') ? '\r\n' : '\n'
    const lines = original.split(/\r?\n/)
    const plugin = section(lines, 'liquidGlassTheme')
    if (!plugin) process.exit(0)

    const wasEnabled = scalar(plugin.lines, 'enabled') === true
    const savedVibrancy = scalar(plugin.lines, 'vibrancyBeforeTheme')
    const previousFrontend = scalar(plugin.lines, 'rendererBeforeVibrancy')
    let changed = false

    if (wasEnabled || typeof savedVibrancy === 'boolean') {
        const appearance = section(lines, 'appearance')
        if (appearance) {
            const restored = typeof savedVibrancy === 'boolean' ? savedVibrancy : false
            setScalar(appearance.lines, 'vibrancy', restored)
            lines.splice(appearance.start, appearance.end - appearance.start, ...appearance.lines)
            changed = true
        }
    }

    if (wasEnabled && typeof previousFrontend === 'string' && previousFrontend) {
        const terminal = section(lines, 'terminal')
        if (terminal && scalar(terminal.lines, 'frontend') === 'xterm') {
            setScalar(terminal.lines, 'frontend', JSON.stringify(previousFrontend))
            lines.splice(terminal.start, terminal.end - terminal.start, ...terminal.lines)
            changed = true
        }
    }

    // Remove this plugin's settings block after restoring the host settings.
    const currentPlugin = section(lines, 'liquidGlassTheme')
    if (currentPlugin) {
        lines.splice(currentPlugin.start, currentPlugin.end - currentPlugin.start)
        changed = true
    }
    if (changed) await writeFile(path, lines.join(newline))
} catch (error) {
    if (error?.code !== 'ENOENT') {
        console.error(`Liquid Glass Theme cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
        process.exitCode = 1
    }
}
