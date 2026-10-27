import { Component, Injectable, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ConfigProvider, ConfigService, ThemesService } from 'tabby-core'
import { TerminalDecorator } from 'tabby-terminal'
import { SettingsTabProvider } from 'tabby-settings'
import { Subscription } from 'rxjs'
import { DEFAULTS, GlassStyle, options, type GlassOptions } from './style'
import { GlassTerminalDecorator } from './terminal-background'
const stylesheet: string = require('./theme.css')
const KEY = 'liquidGlassTheme'

@Injectable()
class GlassConfig extends ConfigProvider { defaults = { [KEY]: DEFAULTS } }

@Injectable()
class GlassService {
    private subscriptions = new Subscription()
    private style = new GlassStyle(document, stylesheet)
    private rendererSavePending = false
    constructor (config: ConfigService, themes: ThemesService) {
        const refresh = (): void => {
            const active = themes as unknown as { _getActiveColorScheme(): { background?: string } }
            const background = active._getActiveColorScheme()?.background ?? ''
            const value = config.store?.[KEY] ?? DEFAULTS
            this.style.update(value, background)
            this.syncTransparentRenderer(config, value)
        }
        this.subscriptions.add(config.ready$.subscribe(refresh))
        this.subscriptions.add(config.changed$.subscribe(refresh))
        this.subscriptions.add(themes.themeChanged$.subscribe(refresh))
        refresh()
    }
    private syncTransparentRenderer (config: ConfigService, value: GlassOptions): void {
        const terminal = config.store?.terminal
        const plugin = config.store?.[KEY] as GlassOptions | undefined
        if (!terminal || !plugin || this.rendererSavePending) return

        let changed = false
        if (value.enabled && value.windowVibrancy && terminal.frontend !== 'xterm') {
            plugin.rendererBeforeVibrancy ||= terminal.frontend ?? 'xterm-webgl'
            terminal.frontend = 'xterm'
            changed = true
        } else if ((!value.enabled || !value.windowVibrancy) && plugin.rendererBeforeVibrancy) {
            if (terminal.frontend === 'xterm') terminal.frontend = plugin.rendererBeforeVibrancy
            plugin.rendererBeforeVibrancy = ''
            changed = true
        }
        if (!changed) return

        config.requestRestart()
        this.rendererSavePending = true
        void config.save().catch(() => undefined).finally(() => { this.rendererSavePending = false })
    }
    ngOnDestroy (): void { this.subscriptions.unsubscribe(); this.style.destroy() }
}

@Component({
    selector: 'liquid-glass-theme-settings',
    template: `<h3>Liquid Glass Theme</h3>
      <p>统一标签页、工作区侧栏和终端窗格的外观。</p>
      <label><input type="checkbox" [(ngModel)]="value.enabled"> 启用样式</label>
      <label><input type="checkbox" [(ngModel)]="value.windowVibrancy"> 启用窗口透明，透出桌面背景</label>
      <p><small>窗口透明会使用 Tabby 的 Canvas 终端渲染器，并提示重启，以避免 WebGL 终端出现不透明色块。</small></p>
      <label>窗格圆角（px）<input class="form-control" type="number" min="0" max="24" [(ngModel)]="value.radius"></label>
      <label>背景不透明度（%）<input class="form-control" type="number" min="0" max="100" [(ngModel)]="value.opacity"></label>
      <p><small>关闭窗口透明时，主背景、侧栏、文件区和终端使用不透明的系统配色。开启窗口透明后，不透明度控制玻璃表面的颜色浓度。</small></p>
      <div class="wallpaper-setting">
        <span>背景图片</span>
        <input #wallpaperFile class="wallpaper-file" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" (change)="selectWallpaper($event)">
        <button type="button" class="btn btn-secondary" (click)="wallpaperFile.click()">选择图片</button>
        <button *ngIf="value.wallpaper" type="button" class="btn btn-secondary" (click)="value.wallpaper = ''">移除图片</button>
        <img *ngIf="value.wallpaper" class="wallpaper-preview" [src]="value.wallpaper" alt="背景图片预览">
        <label *ngIf="value.wallpaper">图片透明度（%）<input class="form-control" type="number" min="0" max="100" [(ngModel)]="value.wallpaperOpacity"></label>
        <small>选择 PNG、JPEG、WebP、GIF 或 AVIF 图片（最大 100 MB）。图片保存在 Tabby 配置中。</small>
      </div>
      <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving">{{saving ? '保存中…' : '保存'}}</button>
      <span class="save-status" role="status" aria-live="polite">{{status}}</span>`,
    styles: [':host{display:block;max-width:640px}label{display:block;margin:18px 0}.form-control{max-width:220px;margin-top:6px}p{line-height:1.7}.save-status{display:inline-block;margin-left:12px;min-height:1em}.wallpaper-setting{display:grid;justify-items:start;gap:10px;margin:22px 0}.wallpaper-file{display:none}.wallpaper-preview{max-width:320px;max-height:180px;object-fit:cover;border-radius:8px;border:1px solid var(--bs-border-color)}.wallpaper-setting small{opacity:.8}'],
})
class GlassSettings {
    value: GlassOptions
    saving = false
    status = ''
    constructor (private config: ConfigService) { this.value = options(config.store[KEY]) }
    selectWallpaper (event: Event): void {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        if (!file) return
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
            this.status = '图片格式不支持，请选择 PNG、JPEG、WebP、GIF 或 AVIF'
            return
        }
        if (file.size > 100 * 1024 * 1024) {
            this.status = '图片不能超过 100 MB'
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                this.value.wallpaper = reader.result
                this.status = '图片已选择；点击保存后生效'
            }
        }
        reader.onerror = () => { this.status = '读取图片失败' }
        reader.readAsDataURL(file)
    }
    async save (): Promise<void> {
        this.saving = true
        const target = this.config.store[KEY] as GlassOptions
        const previous = options(target)
        const previousVibrancy = this.config.store.appearance.vibrancy
        try {
            const next = options(this.value)
            target.enabled = next.enabled
            target.windowVibrancy = next.windowVibrancy
            target.radius = next.radius
            target.opacity = next.opacity
            target.wallpaper = next.wallpaper
            target.wallpaperOpacity = next.wallpaperOpacity
            delete (target as GlassOptions & { background?: string }).background
            this.value = next
            this.config.store.appearance.vibrancy = next.windowVibrancy
            await this.config.save()
            this.status = this.config.restartRequested ? '已保存；请重启 Tabby 应用终端渲染器更改' : '已保存'
        } catch (error) {
            target.enabled = previous.enabled
            target.windowVibrancy = previous.windowVibrancy
            target.radius = previous.radius
            target.opacity = previous.opacity
            target.wallpaper = previous.wallpaper
            target.wallpaperOpacity = previous.wallpaperOpacity
            this.config.store.appearance.vibrancy = previousVibrancy
            this.status = `保存失败：${error instanceof Error ? error.message : String(error)}`
        } finally { this.saving = false }
    }
}
@Injectable()
class GlassSettingsProvider extends SettingsTabProvider {
    id = 'liquid-glass-theme'
    title = 'Liquid Glass Theme'
    icon = 'adjust'
    getComponentType (): typeof GlassSettings { return GlassSettings }
}
@NgModule({
    imports: [CommonModule, FormsModule], declarations: [GlassSettings],
    providers: [GlassService, { provide: TerminalDecorator, useClass: GlassTerminalDecorator, multi: true },
        { provide: ConfigProvider, useClass: GlassConfig, multi: true },
        { provide: SettingsTabProvider, useClass: GlassSettingsProvider, multi: true }],
})
export default class GraphiteGlassModule {
    constructor (_style: GlassService) {}
}
