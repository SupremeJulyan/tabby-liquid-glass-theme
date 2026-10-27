# Liquid Glass Theme for Tabby

一个独立的 Tabby 外观插件，提供液态玻璃背景、圆角窗格、统一标签页和工作区侧栏样式。安装后可在 **Settings → Liquid Glass Theme** 调整启用状态、窗口透明效果、背景图片、背景不透明度和窗格圆角。未选择背景图片时，窗口透明效果会透出桌面背景。

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
- 背景图片：点击“选择图片”打开系统文件选择器，支持 PNG、JPEG、WebP、GIF 和 AVIF（最大 100 MB）；可单独调节图片透明度或移除图片。图片数据保存在 Tabby 配置中。未添加图片时继续使用桌面背景透明效果。
- 背景不透明度：0–100%，窗口透明开启时控制玻璃表面浓度；窗口透明关闭时，主背景、侧栏、文件区和终端使用不透明的系统配色。
- 窗格圆角：0–24 px，分隔线两端会同步缩进。
- 窗口透明：启用 Tabby 的 Vibrancy，使终端画布可以透出桌面背景；具体效果受桌面合成器影响。启用主题后，xterm 终端背景会透出对应窗格底色，避免 AI 终端与主题面板出现色差。

开启窗口透明时，插件会将终端输出中的 ANSI 背景填充和反显设为透明，让桌面背景透出。为避免 WebGL 前端绘制不透明色块，插件会在透明模式下切换到 Tabby 的 Canvas 终端前端，并在 **Settings** 页面提示重启；关闭样式或窗口透明后会恢复原来的终端前端设置。
