export interface GlassOptions { enabled: boolean; windowVibrancy: boolean; radius: number; opacity: number; rendererBeforeVibrancy: string }
export const DEFAULTS: GlassOptions = { enabled: false, windowVibrancy: true, radius: 12, opacity: 100, rendererBeforeVibrancy: '' }
export const STYLE_ID = 'tabby-liquid-glass-theme'

export function options (value: Partial<GlassOptions> = {}): GlassOptions {
    const clamp = (value: unknown, fallback: number, min: number, max: number): number =>
        typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
    return {
        enabled: value.enabled === true,
        windowVibrancy: value.windowVibrancy !== false,
        radius: clamp(value.radius, 12, 0, 24),
        opacity: clamp(value.opacity, 100, 0, 100),
        rendererBeforeVibrancy: typeof value.rendererBeforeVibrancy === 'string' ? value.rendererBeforeVibrancy : '',
    }
}

/** Applies only plugin-owned DOM state, without changing Tabby's saved settings. */
export class GlassStyle {
    private element?: HTMLStyleElement
    constructor (private document: Document, private stylesheet: string) {}
    update (input: Partial<GlassOptions>, systemBackground: string): void {
        const value = options(input)
        if (!value.enabled) { this.destroy(); return }
        const match = /^#([0-9a-f]{6})$/i.exec(systemBackground)
        if (!match) return
        if (!this.element) {
            this.element = this.document.createElement('style')
            this.element.id = STYLE_ID
            this.document.head.append(this.element)
        }
        const rgb = match[1].match(/.{2}/g)!.map(part => Number.parseInt(part, 16)).join(',')
        const alpha = value.windowVibrancy ? value.opacity / 100 : 1
        this.element.textContent = `body[data-liquid-glass-theme]{--gg-radius:${value.radius}px;--gg-alpha:${alpha};--gg-bg-rgb:${rgb};}\n${this.stylesheet}`
        this.document.body.setAttribute('data-liquid-glass-theme', '')
        this.document.body.setAttribute('data-liquid-glass-vibrancy', value.windowVibrancy ? 'enabled' : 'disabled')
    }
    destroy (): void {
        this.element?.remove()
        this.element = undefined
        this.document.body.removeAttribute('data-liquid-glass-theme')
        this.document.body.removeAttribute('data-liquid-glass-vibrancy')
    }
}
