import { Injectable } from '@angular/core'
import { ConfigService, ThemesService } from 'tabby-core'
import { BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal'
const KEY = 'liquidGlassTheme'
type XtermLike = {
    options: { theme?: Record<string, unknown> }
    write?: (data: string | Uint8Array, callback?: () => void) => void
}
type FrontendLike = {
    configure?: (profile: unknown) => void
    xterm?: XtermLike
}

function rgb (hex: string): [number, number, number] | undefined {
    const match = /^#([0-9a-f]{6})$/i.exec(hex)
    if (!match) return undefined
    return [0, 2, 4].map(index => Number.parseInt(match[1].slice(index, index + 2), 16)) as [number, number, number]
}

/** Codex paints prompt/history surfaces by blending white or black into OSC 11's RGB. */
function codexSurfaceColors (background: string): Set<string> {
    const base = rgb(background)
    if (!base) return new Set()
    const light = (base[0] * 299 + base[1] * 587 + base[2] * 114) / 1000 >= 128
    const top = light ? 0 : 255
    const alphas = light ? [0.02, 0.04] : [0.02, 0.04, 0.12, 0.16]
    const colors = new Set<string>()
    for (const alpha of alphas) {
        const color = base.map(channel => Math.floor(top * alpha + channel * (1 - alpha)))
        // Accommodate the TUI's integer rounding.
        // Codex rounds its blended colors independently from the RGB triplet
        // reported by the terminal. A few channels can differ by 3–4 values.
        for (let red = -4; red <= 4; red++) for (let green = -4; green <= 4; green++) for (let blue = -4; blue <= 4; blue++) {
            colors.add(color.map((channel, index) => Math.max(0, Math.min(255, channel + [red, green, blue][index])).toString(16).padStart(2, '0')).join(''))
        }
        const nearestIndices = Array.from({ length: 240 }, (_, index) => index + 16)
            .sort((left, right) => perceptualDistance(indexedColor(left), color) - perceptualDistance(indexedColor(right), color))
            .slice(0, 2)
        for (const index of nearestIndices) {
            const nearest = indexedColor(index)
            if (nearest) colors.add(nearest)
        }
    }
    return colors
}

function perceptualDistance (hex: string | undefined, color: number[]): number {
    if (!hex) return Number.POSITIVE_INFINITY
    const candidate = rgb(`#${hex}`)!
    const toLab = (channels: number[]): [number, number, number] => {
        const linear = channels.map(channel => {
            const value = channel / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
        })
        const [r, g, b] = linear
        const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
        const y = r * 0.2126 + g * 0.7152 + b * 0.0722
        const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
        const f = (value: number) => value > 0.008856 ? value ** (1 / 3) : 7.787 * value + 16 / 116
        const fx = f(x)
        const fy = f(y)
        const fz = f(z)
        return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
    }
    const a = toLab(candidate)
    const b = toLab(color)
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

function makeCodexSurfacesTransparent (input: string, colors: Set<string>): string {
    if (!colors.size) return input
    return input.replace(/\x1b\[([0-9;:]*)m/g, (sequence, parameters: string) => {
        const values = parameters.split(';')
        let changed = false
        for (let index = 0; index < values.length;) {
            const colon = /^(48:2:|48:5:)/.exec(values[index])
            if (colon) {
                const components = values[index].split(':')
                const isTrueColor = components[1] === '2'
                const color = isTrueColor
                    ? components.slice(-3).map(value => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, '0')).join('').toLowerCase()
                    : indexedColor(Number(components.at(-1)))
                if (color && colors.has(color)) {
                    values.splice(index, 1, '49')
                    changed = true
                    continue
                }
                index++
            } else if (values[index] === '48' && values[index + 1] === '2' && index + 4 < values.length) {
                const color = values.slice(index + 2, index + 5).map(value => Math.max(0, Math.min(255, Number(value))).toString(16).padStart(2, '0')).join('').toLowerCase()
                if (colors.has(color)) {
                    values.splice(index, 5, '49')
                    changed = true
                    continue
                }
                index += 5
            } else if (values[index] === '48' && values[index + 1] === '5' && index + 2 < values.length) {
                const color = indexedColor(Number(values[index + 2]))
                if (color && colors.has(color)) {
                    values.splice(index, 3, '49')
                    changed = true
                    continue
                }
                index += 3
            } else index++
        }
        return changed ? `\x1b[${values.join(';')}m` : sequence
    })
}

function indexedColor (index: number): string | undefined {
    const basic = ['000000', '800000', '008000', '808000', '000080', '800080', '008080', 'c0c0c0', '808080', 'ff0000', '00ff00', 'ffff00', '0000ff', 'ff00ff', '00ffff', 'ffffff']
    if (index >= 0 && index < 16) return basic[index]
    if (index >= 232 && index <= 255) {
        const value = (8 + (index - 232) * 10).toString(16).padStart(2, '0')
        return value.repeat(3)
    }
    if (index >= 16 && index <= 231) {
        const levels = [0, 95, 135, 175, 215, 255]
        const offset = index - 16
        return [levels[Math.floor(offset / 36)], levels[Math.floor(offset / 6) % 6], levels[offset % 6]]
            .map(value => value.toString(16).padStart(2, '0')).join('')
    }
    return undefined
}

/** Let xterm use the pane surface painted by the glass theme. */
@Injectable()
export class GlassTerminalDecorator extends TerminalDecorator {
    private configureOriginals = new WeakMap<BaseTerminalTabComponent<any>, (profile: unknown) => void>()
    private xtermWriteOriginals = new WeakMap<BaseTerminalTabComponent<any>, NonNullable<XtermLike['write']>>()
    private pendingOutput = new WeakMap<BaseTerminalTabComponent<any>, string>()
    private outputDecoders = new WeakMap<BaseTerminalTabComponent<any>, TextDecoder>()

    constructor (private config: ConfigService, private themes: ThemesService) { super() }

    attach (terminal: BaseTerminalTabComponent<any>): void {
        const frontend = terminal.frontend as FrontendLike | undefined
        if (!frontend?.configure || !frontend.xterm) return

        const original = frontend.configure.bind(frontend)
        this.configureOriginals.set(terminal, original)
        frontend.configure = profile => {
            original(profile)
            this.sync(terminal, frontend)
        }
        // Filter at xterm's final text write boundary so session output and direct
        // frontend writes both receive the same SGR handling.
        const xterm = frontend.xterm
        if (xterm.write) {
            const xtermWrite = xterm.write.bind(xterm)
            this.xtermWriteOriginals.set(terminal, xtermWrite)
            this.outputDecoders.set(terminal, new TextDecoder())
            xterm.write = (data, callback) => {
                // Tabby forwards PTY data as Uint8Array. Decode incrementally so UTF-8
                // characters split across writes remain intact, then encode the filtered
                // output back to the same xterm input type.
                const decoded = typeof data === 'string'
                    ? data
                    : this.outputDecoders.get(terminal)!.decode(data, { stream: true })
                const filtered = this.filterOutput(terminal, decoded)
                return xtermWrite(typeof data === 'string' ? filtered : new TextEncoder().encode(filtered), callback)
            }
        }
        this.subscribeUntilDetached(terminal, this.config.changed$.subscribe(() => {
            frontend.configure?.(terminal.profile)
        }))
        frontend.configure(terminal.profile)
    }

    detach (terminal: BaseTerminalTabComponent<any>): void {
        const original = this.configureOriginals.get(terminal)
        const frontend = terminal.frontend as FrontendLike | undefined
        if (original && frontend) {
            frontend.configure = original
            original(terminal.profile)
        }
        const originalWrite = this.xtermWriteOriginals.get(terminal)
        if (originalWrite && frontend?.xterm) frontend.xterm.write = originalWrite
        terminal.element?.nativeElement?.classList.remove('liquid-glass-terminal')
        this.configureOriginals.delete(terminal)
        this.xtermWriteOriginals.delete(terminal)
        this.outputDecoders.delete(terminal)
        this.pendingOutput.delete(terminal)
        super.detach(terminal)
    }

    private sync (terminal: BaseTerminalTabComponent<any>, frontend: FrontendLike): void {
        const enabled = this.config.store?.[KEY]?.enabled === true
        terminal.element?.nativeElement?.classList.toggle('liquid-glass-terminal', enabled)
        if (!enabled || !frontend.xterm?.options.theme) return
        // The glass tint is a visual surface, not the terminal's color scheme.
        // TUIs query xterm's default background and derive their own panel colors
        // from it, so retain the active Tabby scheme's RGB while making the
        // terminal canvas transparent. A profile-specific scheme takes priority.
        const profileScheme = (terminal.profile as { terminalColorScheme?: { background?: string } }).terminalColorScheme
        const activeScheme = this.themes._getActiveColorScheme() as { background?: string }
        const background = profileScheme?.background ?? activeScheme?.background
        if (!background || !/^#[0-9a-f]{6}$/i.test(background)) return
        frontend.xterm.options.theme = { ...frontend.xterm.options.theme, background: `${background}00` }
    }

    private filterOutput (terminal: BaseTerminalTabComponent<any>, data: string): string {
        const combined = (this.pendingOutput.get(terminal) ?? '') + data
        this.pendingOutput.delete(terminal)
        const settings = this.config.store?.[KEY]
        if (settings?.enabled !== true || settings.windowVibrancy === false) return combined
        const profileScheme = (terminal.profile as { terminalColorScheme?: { background?: string } }).terminalColorScheme
        const activeScheme = this.themes._getActiveColorScheme() as { background?: string }
        const background = profileScheme?.background ?? activeScheme?.background
        if (!background) return combined

        if (combined.endsWith('\x1b')) {
            this.pendingOutput.set(terminal, '\x1b')
            return combined.slice(0, -1)
        }
        const escapeStart = combined.lastIndexOf('\x1b[')
        let complete = combined
        if (escapeStart >= 0 && !/[\x40-\x7e]/.test(combined.slice(escapeStart + 2))) {
            this.pendingOutput.set(terminal, combined.slice(escapeStart))
            complete = combined.slice(0, escapeStart)
        }
        return makeCodexSurfacesTransparent(complete, codexSurfaceColors(background))
    }
}
