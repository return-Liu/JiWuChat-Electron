# Release v1.0.4

[Latest] (https://github.com/return-Liu/JiWuChat-Electron/releases/latest)

[v1.0.4] (https://github.com/return-Liu/JiWuChat-Electron/tree/v1.0.4)

# 1.0.4 版本说明

本次更新聚焦**个性装扮（动态壁纸）体验优化**与**好友 / 群通知交互重构**：动态主题下的消息气泡、群邀请卡片、通知面板统一为毛玻璃半透明风格，消息气泡区分左右；好友申请与群通知由弹窗改为在好友列表右栏内联展示；同时修复了若干壁纸加载与展示问题。

## 更新说明

### 个性装扮（动态主题）体验优化

- **壁纸卡片自适应填满整行**：虚拟滚动网格新增拉伸模式（`fillWidth`），壁纸卡片按容器宽度均摊拉伸并保持宽高比，消除列表右侧因固定卡宽产生的大片空白。
- **消息气泡区分左右**：自己的气泡（右侧）使用主题主色背景 + 白字，对方的气泡（左侧）使用浅色背景 + 深字；动态主题下统一毛玻璃半透明（自己的用壁纸主色、对方用深色），文字转白并加投影，在视频 / 图片壁纸上清晰可读。
- **群邀请卡片动态主题适配**：群邀请 / 群通知卡片在动态主题下由「透明无背景」改为半透明深底 + 毛玻璃（`backdrop-filter: blur`），与消息气泡风格统一。
- **好友 / 群通知面板动态主题适配**：右栏通知面板在动态主题下卡片改为半透明毛玻璃，文字转白加投影，主色取自壁纸吸取色。
- **修复壁纸加载失败**：修复「阿尔托莉雅」壁纸因文件名含空格、代码中路径漏写空格导致的视频与封面 404 问题。
- **壁纸名称中文化**：9 个英文壁纸名统一翻译为诗意中文名（如「阿米娅 · 晶耀之冠」「守岸人 · 星垂旷野」等），风格与既有中文主题一致。
- **生成脚本保留中文名**：`generate-wallpapers.js` 重新生成壁纸清单时，会复用已翻译好的中文名称，不再被自动提取的英文名覆盖。

### 好友 / 群通知交互重构

- **通知改为右栏内联展示**：原「收到的好友申请」「我发起的申请」「群聊申请记录」「群申请管理」四个弹窗全部移除，改为点击好友列表顶部「好友通知」「群通知」后，在好友列表右栏内联展示，支持接受 / 拒绝 / 撤回 / 审核等完整操作。

### 好友分组精简

- **移除「我的设备」与「特别关心」分组**：精简好友列表分组，仅保留「机器人」「我的好友」两个分组。

## 新功能与体验增强

- feat(wallpaper): 壁纸卡片按容器宽度自适应拉伸，消除右侧空白
- feat(wallpaper): 英文壁纸名统一翻译为中文，生成脚本保留已翻译名称
- feat(chat): 消息气泡区分左右，自己的气泡使用主题主色
- feat(notice): 好友 / 群通知由弹窗改为好友列表右栏内联展示
- feat(theme): 动态主题下气泡、群邀请卡片、通知面板统一毛玻璃半透明风格

## 修复了以下问题

- fix(wallpaper): 修复「阿尔托莉雅」壁纸文件名含空格导致视频 / 封面 404 的问题
- fix(wallpaper): 修复壁纸卡片固定宽度导致行尾出现大片空白的问题

## 移除

- refactor(notice): 移除 ReceivedFriendApplicationsModal / SentFriendApplicationsModal / ApplicationListModal / ManageApplicationsModal 四个弹窗组件
- refactor(friend): 移除好友列表「我的设备」「特别关心」分组
- chore(test): 移除单元测试文件

## 下载

各平台安装包见下表，实际可用资源以 Release 页面为准。

| 平台                       | 下载地址                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Windows x64 安装程序       | [JiwuChat_1.0.4_x64-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.4/JiwuChat_1.0.4_x64-setup.exe)   |
| Windows ia32 安装程序      | [JiwuChat_1.0.4_ia32-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.4/JiwuChat_1.0.4_ia32-setup.exe) |
| Windows 通用（x64 + ia32） | [JiwuChat_1.0.4-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/download/v1.0.4/JiwuChat_1.0.4-setup.exe)           |

## 后续计划

沿用既有版本的待办，以下内容不属于本次交付：

- 本地消息存储
- 用户版本埋点
- 设备间消息 / 文件传输（跨设备互联）
