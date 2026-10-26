import { Injectable } from '@angular/core'
import { ConfigService } from 'tabby-core'
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
        frontend.xterm.options.theme = { ...frontend.xterm.options.theme, background: '#00000000' }
    }
}
