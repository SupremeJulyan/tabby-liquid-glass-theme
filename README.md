# Liquid Glass Theme for Tabby

一个独立的 Tabby 外观插件，提供液态玻璃背景、圆角窗格、统一标签页和工作区侧栏样式。安装后可在 **Settings → Liquid Glass Theme** 调整启用状态、窗口透明效果、背景不透明度和窗格圆角。背景颜色跟随 Tabby 当前配色方案。

插件不依赖 AWM。若安装了 AWM，会自动套用工作区侧栏、AI 标题栏及分隔线样式；无需修改 AWM 源码。分隔线绘制缩进与窗格圆角共享同一数值，拖动热区不变。

## 安装

```sh
npm install --legacy-peer-deps
npm run build
npm pack
```

在 Tabby 的插件目录安装生成的 tarball：

```sh
npm install --omit=dev --legacy-peer-deps /absolute/path/tabby-liquid-glass-theme-0.1.0.tgz
```

重启 Tabby，在 **Settings → Liquid Glass Theme** 开启样式。插件默认关闭；保存窗口透明选项时，会同步设置 Tabby 的 Vibrancy。

## 设置

- 背景颜色：使用 Tabby 当前配色方案，不由插件单独指定。
- 背景不透明度：0–100%，控制玻璃表面浓度，不降低文字透明度。
- 窗格圆角：0–24 px，分隔线两端会同步缩进。
- 窗口透明：启用 Tabby 的 Vibrancy，使终端画布可以透出桌面背景；具体效果受桌面合成器影响。启用主题后，xterm 终端背景会透出对应窗格底色，避免 AI 终端与主题面板出现色差。

Codex 等终端应用自行绘制的输入框等界面色块会保留。关闭样式开关会恢复 Tabby 原本的终端背景。
