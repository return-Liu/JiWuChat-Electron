# Release v1.0.3

[Latest] (https://github.com/return-Liu/JiWuChat-Electron/releases/latest)

[v1.0.3] (https://github.com/return-Liu/JiWuChat-Electron/tree/v1.0.3)

# 1.0.3 版本说明

本次更新聚焦**桌面端稳定性**、**系统托盘**与**安装包体积优化**：修复桌面端启动白屏（页面 404）的问题，新增系统托盘常驻与快捷操作，并大幅精简安装包体积，提升启动与使用体验。

## 更新说明

- **修复桌面端白屏**：修复桌面端启动后主窗口白屏、提示 `Page not found` 的问题。原因为通过 `file://` 协议加载页面时，前端 history 路由无法正常工作；现改为注册自定义协议 `app://` 加载静态资源，使路由与资源路径在桌面端正确解析，官网仍保持 history 路由不变。
- **新增系统托盘**：支持最小化到系统托盘常驻后台，托盘图标提供「显示主窗口 / 隐藏主窗口 / 退出极物聊天」菜单；左键单击托盘图标可快速切换主窗口显示与隐藏，点击窗口关闭按钮时自动隐藏到托盘而非直接退出。
- **安装包体积优化**：通过排除运行时无关依赖、精简 Electron 语言包（仅保留中文）、将未压缩的 WAV 铃声转为 MP3、移除冗余许可证文件等方式，显著减小安装包与安装后占用体积。
- **窗口标题规范化**：统一桌面端主窗口标题为「极物聊天」。
- **版本号统一管理**：应用版本号统一从 `package.json` 读取，避免多处硬编码导致版本不一致。

## 新功能与体验增强

- feat(tray): 新增系统托盘，支持显示/隐藏主窗口与退出应用
- feat(tray): 点击托盘图标可快速切换主窗口显示/隐藏
- feat(win): 点击窗口关闭按钮时隐藏到托盘常驻后台

## 修复了以下问题

- fix(win): 修复桌面端启动白屏、提示 `Page not found` 的问题（改用自定义协议 `app://` 加载页面）
- fix(win): 修复桌面端主窗口标题显示异常的问题，统一为「极物聊天」
- fix(version): 修复前端下载链接版本号硬编码、与 `package.json` 不一致的问题

## 构建与发布优化

- chore(build): 排除 `node_modules` 等运行时无关内容，避免打入安装包
- chore(build): 精简 Electron 语言包，仅保留中文（`electronLanguages: ["zh-CN"]`）
- chore(assets): 来电铃声由 WAV 转为 MP3，显著减小体积
- chore(build): 打包后移除冗余的 `LICENSES.chromium.html` 等文件
- chore(script): 新增构建辅助脚本（静态产物复制、音频转换、打包后清理）

## 下载

各平台安装包见下表，实际可用资源以 Release 页面为准。

| 平台                       | 下载地址                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Windows x64 安装程序       | [JiwuChat_1.0.3_x64-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.3/JiwuChat_1.0.3_x64-setup.exe)   |
| Windows ia32 安装程序      | [JiwuChat_1.0.3_ia32-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.3/JiwuChat_1.0.3_ia32-setup.exe) |
| Windows 通用（x64 + ia32） | [JiwuChat_1.0.3-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.3/JiwuChat_1.0.3-setup.exe)           |

## 后续计划

沿用既有版本的待办，以下内容不属于本次交付：

- 本地消息存储
- 用户版本埋点
