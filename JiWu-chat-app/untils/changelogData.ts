/**
 * 更新日志静态数据（与官网 blog.jiwuchat.top 一致）
 *
 * 每个版本对应一条记录，body 为 Markdown 格式的版本说明正文。
 * 首页更新日志直接读取本文件，无需请求 GitHub API 或后端接口。
 * 新增版本时，在下方数组头部插入一条记录即可。
 */

export interface ChangelogEntry {
    /** 版本号（如 v1.0.1） */
    tag: string;
    /** 版本标题 */
    title: string;
    /** 发布日期（YYYY-MM-DD） */
    date: string;
    /** 是否为预发布版本 */
    prerelease?: boolean;
    /** Markdown 格式的版本说明正文 */
    body: string;
}

const v1_0_1 = `本次更新聚焦**桌面端安装体验**与 **Windows 系统集成**：由一键静默安装改为向导式安装，支持自定义安装目录，修复安装完成后桌面不生成快捷方式的问题，并统一应用系统标识，改善任务栏、通知与跳转列表的关联表现。

## 更新说明

- **安装更可控**：由「一键静默安装」改为**向导式安装**，安装过程可视化，用户可逐步确认；支持**自定义安装目录**，不再强制安装到默认路径。
- **桌面快捷方式更可靠**：修复安装完成后桌面不生成快捷方式的问题；安装器提升为「所有用户」安装模式并支持请求管理员权限，确保快捷方式正确写入当前用户桌面，桌面与开始菜单均创建「极物聊天」快捷方式。
- **系统集成更规范**：修复 \`AppUserModelId\` 使用错误占位值的问题，统一为 \`com.jiwu.chat\`，使 Windows 端的任务栏图标分组、桌面通知、跳转列表（Jump List）能正确关联到应用。
- **发布链路更稳定**：补充 electron-builder 的 GitHub 发布配置，修复打包时 \`Cannot read properties of null (reading 'channel')\` 报错；更新前端 GitHub 仓库引用为 \`JiWuChat-Electron\`。

## 新功能与体验增强

- feat(nsis): 安装器由一键静默安装改为向导式安装，支持自定义安装目录与多语言界面
- feat(nsis): 开启「所有用户」安装模式与管理员权限请求，确保桌面及开始菜单快捷方式正确创建

## 修复了以下问题

- fix(win): 修复 \`AppUserModelId\` 为错误占位值 \`com.yourcompany.yourapp\` 的问题，统一为 \`com.jiwu.chat\`
- fix(build): 修复 electron-builder 因缺少 GitHub 发布配置导致的打包报错（\`Cannot read properties of null (reading 'channel')\`）

## 构建与发布优化

- chore(publish): 补充 GitHub 发布配置（\`owner: return-Liu\`，\`repo: JiWuChat-Electron\`）
- chore(repo): 更新前端 GitHub 仓库引用为 \`JiWuChat-Electron\`（更新日志、官网下载链接等）
- chore(clean): 清理旧版本（v2.1.4）打包残留目录

## 下载

各平台安装包见下表，实际可用资源以 Release 页面为准。

| 平台 | 下载地址 |
| --- | --- |
| Windows x64 安装程序 | [JiwuChat_1.0.1_x64-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.1/JiwuChat_1.0.1_x64-setup.exe) |
| Windows ia32 安装程序 | [JiwuChat_1.0.1_ia32-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.1/JiwuChat_1.0.1_ia32-setup.exe) |
| Windows 通用（x64 + ia32） | [JiwuChat_1.0.1-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.1/JiwuChat_1.0.1-setup.exe) |

## 后续计划

沿用既有版本的待办，以下内容不属于本次交付：

- 本地消息存储
- 用户版本埋点`;

const v1_0_0 = `极物聊天（JiWu Chat）首个正式版本发布。一款基于 Nuxt 3 + Electron 的即时通讯软件，一套代码同时支持 Web 端与桌面端，提供完整的即时通讯能力。

## 核心功能

### 即时通讯

- 单聊、群聊、好友管理
- 支持文字、图片、语音、文件等多种消息格式
- 消息撤回、聊天记录搜索

### 音视频通话

- 基于 WebRTC（PeerJS / Simple-Peer）的一对一语音与视频通话
- 低延迟、高清晰度
- 实时屏幕共享

### 文件传输

- 图片、文件、媒体预览与上传
- 文件断点续传，传输过程加密

### 国际化

- 中英文双语切换（i18n）

### 主题系统

- 浅色 / 深色模式
- 支持自定义主题色

## 多平台支持

- **Web 端**：基于 Nuxt 3 的响应式 Web 应用
- **桌面端**：Electron 打包的跨平台客户端，支持 Windows / macOS / Linux`;

/** 更新日志列表（按版本从新到旧排列，新版本插入头部） */
export const CHANGELOG_DATA: ChangelogEntry[] = [
    {
        tag: "v1.0.1",
        title: "1.0.1 版本说明",
        date: "2026-09-28",
        body: v1_0_1,
    },
    {
        tag: "v1.0.0",
        title: "1.0.0 版本说明",
        date: "2026-09-01",
        body: v1_0_0,
    },
];
