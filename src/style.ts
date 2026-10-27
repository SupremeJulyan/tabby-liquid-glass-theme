export interface GlassOptions { enabled: boolean; windowVibrancy: boolean; radius: number; opacity: number; wallpaper: string; wallpaperOpacity: number; rendererBeforeVibrancy: string }
export const DEFAULTS: GlassOptions = { enabled: false, windowVibrancy: true, radius: 12, opacity: 100, wallpaper: '', wallpaperOpacity: 100, rendererBeforeVibrancy: '' }
export const STYLE_ID = 'tabby-liquid-glass-theme'

export function options (value: Partial<GlassOptions> = {}): GlassOptions {
    const clamp = (value: unknown, fallback: number, min: number, max: number): number =>
        typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
    // Tabby serializes long config strings as folded YAML scalars, inserting
    // whitespace at line wraps. Base64 data URLs remain valid after removing it.
    const wallpaper = typeof value.wallpaper === 'string' ? value.wallpaper.replace(/\s/g, '') : ''
    return {
        enabled: value.enabled === true,
        windowVibrancy: value.windowVibrancy !== false,
        radius: clamp(value.radius, 12, 0, 24),
        opacity: clamp(value.opacity, 100, 0, 100),
        wallpaper: /^data:image\/(?:png|jpeg|webp|gif|avif);base64,[a-z\d+/]+=*$/i.test(wallpaper) ? wallpaper : '',
        wallpaperOpacity: clamp(value.wallpaperOpacity, 100, 0, 100),
        rendererBeforeVibrancy: typeof value.rendererBeforeVibrancy === 'string' ? value.rendererBeforeVibrancy : '',
    }
}

/** Applies only plugin-owned DOM state, without changing Tabby's saved settings. */
export class GlassStyle {
    private element?: HTMLStyleElement
    private wallpaperData = ''
    private wallpaperUrl = ''
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
        const wallpaperUrl = this.getWallpaperUrl(value.wallpaper)
        const wallpaper = wallpaperUrl ? `url(${JSON.stringify(wallpaperUrl)})` : 'none'
        this.element.textContent = `body[data-liquid-glass-theme]{--gg-radius:${value.radius}px;--gg-alpha:${alpha};--gg-bg-rgb:${rgb};--gg-wallpaper:${wallpaper};--gg-wallpaper-opacity:${value.wallpaperOpacity / 100};}\n${this.stylesheet}`
        this.document.body.setAttribute('data-liquid-glass-theme', '')
        this.document.body.setAttribute('data-liquid-glass-vibrancy', value.windowVibrancy ? 'enabled' : 'disabled')
        if (value.wallpaper) this.document.body.setAttribute('data-liquid-glass-wallpaper', '')
        else this.document.body.removeAttribute('data-liquid-glass-wallpaper')
    }
    private getWallpaperUrl (data: string): string {
        if (data === this.wallpaperData) return this.wallpaperUrl
        this.revokeWallpaperUrl()
        this.wallpaperData = data
        if (!data) return ''
        try {
            const comma = data.indexOf(',')
            const mime = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(data)?.[1]
            if (comma < 0 || !mime) return ''
            const binary = atob(data.slice(comma + 1).replace(/\s/g, ''))
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
            const urlApi = this.document.defaultView?.URL ?? URL
            this.wallpaperUrl = urlApi.createObjectURL(new Blob([bytes], { type: mime }))
            return this.wallpaperUrl
        } catch { return '' }
    }
    private revokeWallpaperUrl (): void {
        if (!this.wallpaperUrl) return
        const urlApi = this.document.defaultView?.URL ?? URL
        urlApi.revokeObjectURL(this.wallpaperUrl)
        this.wallpaperUrl = ''
    }
    destroy (): void {
        this.revokeWallpaperUrl()
        this.wallpaperData = ''
        this.element?.remove()
        this.element = undefined
        this.document.body.removeAttribute('data-liquid-glass-theme')
        this.document.body.removeAttribute('data-liquid-glass-vibrancy')
        this.document.body.removeAttribute('data-liquid-glass-wallpaper')
    }
}
