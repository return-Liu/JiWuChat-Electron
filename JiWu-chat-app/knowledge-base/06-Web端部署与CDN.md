# Web端部署与CDN

## 静态生成

```bash
pnpm generate        # 产出 dist/ 与 .output/
```

产物为纯静态，可托管到任意 Web 服务器 / 对象存储 / CDN。
注意 `generate` 链路**不设** `NUXT_PUBLIC_WALLPAPER_BASE`，壁纸保持本地 `/theme`。

## 主题资源托管

动态背景视频位于 `dist/theme/`（来自 `public/theme`）。若桌面端要从 CDN 拉取，
需保证官网 `https://jiwuchat.com/theme` 与 Web 构建产物同源托管了同样的 `theme/` 目录
（Web 构建会自动带上，故同源托管即满足）。

## 浏览器标签图标

`nuxt.config.ts` 的 `app.head` 已配置：

```ts
link: [
  { rel: "icon", type: "image/png", href: "/logo.png" },
  { rel: "apple-touch-icon", href: "/logo.png" },
]
```

使 Web 构建的浏览器标签显示 `logo.png`（桌面端窗口图标由 `build/icon/logo.ico` 单独配置，互不影响）。

## 部署检查清单

- [ ] `dist/theme` 已随站点一起发布（或 CDN 已托管）。
- [ ] favicon 在根路径可访问。
- [ ] 若启用桌面端 CDN 壁纸，确认 `https://jiwuchat.com/theme` 可达。
