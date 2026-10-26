import { Component, Injectable, NgModule } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ConfigProvider, ConfigService } from 'tabby-core'
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
    constructor (config: ConfigService) {
        const refresh = (): void => this.style.update(config.store?.[KEY] ?? DEFAULTS)
        this.subscriptions.add(config.ready$.subscribe(refresh))
        this.subscriptions.add(config.changed$.subscribe(refresh))
        refresh()
    }
    ngOnDestroy (): void { this.subscriptions.unsubscribe(); this.style.destroy() }
}

@Component({
    selector: 'liquid-glass-theme-settings',
    template: `<h3>Liquid Glass Theme</h3>
      <p>统一标签页、工作区侧栏和终端窗格的外观。</p>
      <label><input type="checkbox" [(ngModel)]="value.enabled"> 启用样式</label>
      <label><input type="checkbox" [(ngModel)]="value.windowVibrancy"> 启用窗口透明，透出桌面背景</label>
      <label>窗格圆角（px）<input class="form-control" type="number" min="0" max="24" [(ngModel)]="value.radius"></label>
      <label>背景颜色<input class="form-control color-control" type="color" [(ngModel)]="value.background"></label>
      <label>背景不透明度（%）<input class="form-control" type="number" min="0" max="100" [(ngModel)]="value.opacity"></label>
      <p><small>透出桌面需要启用窗口透明；不透明度控制主题面板和终端底色。</small></p>
      <button type="button" class="btn btn-primary" (click)="save()" [disabled]="saving">{{saving ? '保存中…' : '保存'}}</button>
      <span class="save-status" role="status" aria-live="polite">{{status}}</span>`,
    styles: [':host{display:block;max-width:640px}label{display:block;margin:18px 0}.form-control{max-width:220px;margin-top:6px}.color-control{height:42px;padding:4px}p{line-height:1.7}.save-status{display:inline-block;margin-left:12px;min-height:1em}'],
})
class GlassSettings {
    value: GlassOptions
    saving = false
    status = ''
    constructor (private config: ConfigService) { this.value = options(config.store[KEY]) }
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
            target.background = next.background
            this.value = next
            this.config.store.appearance.vibrancy = next.windowVibrancy
            await this.config.save()
            this.status = '已保存'
        } catch (error) {
            target.enabled = previous.enabled
            target.windowVibrancy = previous.windowVibrancy
            target.radius = previous.radius
            target.opacity = previous.opacity
            target.background = previous.background
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
