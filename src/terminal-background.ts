import { Injectable } from '@angular/core'
import { ConfigService, ThemesService } from 'tabby-core'
import { BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal'
const KEY = 'liquidGlassTheme'
type XtermLike = {
    options: { theme?: Record<string, unknown> }
    write?: (data: string | Uint8Array, callback?: () => void) => void
    reset?: () => void
}
type FrontendLike = {
    configure?: (profile: unknown) => void
    restoreState?: (state: string) => void
    serializeAddon?: { serialize: (options?: Record<string, unknown>) => string }
    xterm?: XtermLike
}

function makeCodexSurfacesTransparent (input: string): string {
    return input.replace(/\x1b\[([0-9;:]*)m/g, (sequence, parameters: string) => {
        const values = parameters.split(';')
        let changed = false
        for (let index = 0; index < values.length;) {
            // Vibrant terminal surfaces must not retain explicit cell fills.
            // Codex emits many RGB and palette variants for its history cards,
            // so matching only colors derived from the terminal background is
            // not sufficient to remove every opaque rectangle.
            if (/^48:(?:2|5):/.test(values[index])) {
                values.splice(index, 1, '49')
                changed = true
            } else if (/^(?:4[0-7]|10[0-7])$/.test(values[index])) {
                values.splice(index, 1, '49')
                changed = true
            } else if (values[index] === '48' && values[index + 1] === '2' && index + 4 < values.length) {
                values.splice(index, 5, '49')
                changed = true
            } else if (values[index] === '48' && values[index + 1] === '5' && index + 2 < values.length) {
                values.splice(index, 3, '49')
                changed = true
            } else {
                index++
            }
        }
        return changed ? `\x1b[${values.join(';')}m` : sequence
    })
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
        // Tabby restores saved scrollback before decorators attach, so those
        // writes bypass the filter above. Rewrite only matching saved surfaces
        // after xterm has finished consuming its initial restore stream.
        if (typeof terminal.savedState === 'string' && frontend.restoreState && xterm.reset && xterm.write) {
            const savedState = terminal.savedState
            const filteredState = this.filterOutput(terminal, savedState)
            if (filteredState !== savedState) {
                xterm.write('', () => {
                    // Include Tabby's “History restored” marker and any writes
                    // queued immediately after its saved-state replay.
                    const currentState = frontend.serializeAddon?.serialize({
                        excludeAltBuffer: true,
                        excludeModes: true,
                        scrollback: 1000,
                    }) ?? filteredState
                    const cleanState = this.filterOutput(terminal, currentState)
                    terminal.savedState = cleanState
                    xterm.reset?.()
                    frontend.restoreState?.(cleanState)
                })
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
        return makeCodexSurfacesTransparent(complete)
    }
}
