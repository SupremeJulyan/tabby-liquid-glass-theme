import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
import { BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal'

const KEY = 'liquidGlassTheme'
type XtermLike = { options: { theme?: Record<string, unknown> } }
type FrontendLike = {
    configure?: (profile: unknown) => void
    xterm?: XtermLike
}

const ANSI_COLORS = [
    'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
    'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan', 'brightWhite',
]

function colorKey (value: unknown): string | undefined {
    if (typeof value !== 'string') return
    const color = value.trim().toLowerCase()
    if (/^#[0-9a-f]{6}$/.test(color)) return color
    if (/^#[0-9a-f]{8}$/.test(color) && color.endsWith('ff')) return color.slice(0, 7)
}

function transparentizeSchemeBackground (theme: Record<string, unknown>): Record<string, unknown> {
    const background = colorKey(theme.background)
    const result: Record<string, unknown> = { ...theme, background: '#00000000' }
    if (!background) return result

    // Tabby's active color scheme supplies these ANSI values. When a palette
    // intentionally uses its own background color as an ANSI shade, make that
    // shade transparent too so it follows the Liquid Glass pane surface.
    for (const name of ANSI_COLORS) {
        if (colorKey(theme[name]) === background) result[name] = '#00000000'
    }
    if (Array.isArray(theme.extendedAnsi)) {
        result.extendedAnsi = theme.extendedAnsi.map(color => colorKey(color) === background ? '#00000000' : color)
    }
    return result
}

/** Let xterm use the pane surface painted by the glass theme. */
@Injectable()
export class GlassTerminalDecorator extends TerminalDecorator {
    private configureOriginals = new WeakMap<BaseTerminalTabComponent<any>, (profile: unknown) => void>()

    constructor (private config: ConfigService) { super() }

    attach (terminal: BaseTerminalTabComponent<any>): void {
        const frontend = terminal.frontend as FrontendLike | undefined
        if (!frontend?.configure || !frontend.xterm) return

        const original = frontend.configure.bind(frontend)
        this.configureOriginals.set(terminal, original)
        frontend.configure = profile => {
            original(profile)
            this.sync(terminal, frontend)
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
        terminal.element?.nativeElement?.classList.remove('liquid-glass-terminal')
        this.configureOriginals.delete(terminal)
        super.detach(terminal)
    }

    private sync (terminal: BaseTerminalTabComponent<any>, frontend: FrontendLike): void {
        const enabled = this.config.store?.[KEY]?.enabled === true
        terminal.element?.nativeElement?.classList.toggle('liquid-glass-terminal', enabled)
        if (!enabled || !frontend.xterm?.options.theme) return
        frontend.xterm.options.theme = transparentizeSchemeBackground(frontend.xterm.options.theme)
    }
}
