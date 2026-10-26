import { Injectable } from '@angular/core'
import { ConfigService, ThemesService } from 'tabby-core'
import { BaseTerminalTabComponent, TerminalDecorator } from 'tabby-terminal'
const KEY = 'liquidGlassTheme'
type XtermLike = { options: { theme?: Record<string, unknown> } }
type FrontendLike = {
    configure?: (profile: unknown) => void
    xterm?: XtermLike
}

/** Let xterm use the pane surface painted by the glass theme. */
@Injectable()
export class GlassTerminalDecorator extends TerminalDecorator {
    private configureOriginals = new WeakMap<BaseTerminalTabComponent<any>, (profile: unknown) => void>()

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
}
