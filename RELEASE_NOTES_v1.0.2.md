# Release v1.0.2

[Latest] (https://github.com/return-Liu/JiWuChat-Electron/releases/latest)

[v1.0.2] (https://github.com/return-Liu/JiWuChat-Electron/tree/v1.0.2)

# 1.0.2 版本说明

本次更新聚焦**桌面图标显示**与**打包发布链路**：修复 Windows 端安装后桌面快捷方式、任务栏、开始菜单显示 Electron 默认图标的问题，统一为「极物聊天」品牌图标；同时优化仓库目录结构，规范打包配置，提升构建稳定性。

## 更新说明

- **桌面图标更统一**：修复 Windows 端安装完成后，桌面快捷方式、任务栏、开始菜单仍显示 Electron 默认图标的问题，统一替换为「极物聊天」品牌图标（`logo.ico`，含多尺寸）。修复方式为启用 `signAndEditExecutable`，使 electron-builder 正确将图标写入可执行文件。
- **打包配置更规范**：统一 `win.icon`、`nsis.installerIcon`、`nsis.uninstallerIcon`、`nsis.installerHeaderIcon` 图标配置，确保安装器与卸载器均使用品牌图标。
- **仓库结构更清晰**：将前端项目文件归位至 `JiWu-chat-app` 目录，恢复前后端分离结构（`JiWu-chat-app` 前端 + `JiWu-chat-node` 后端），便于维护与协作。
- **构建流程更稳定**：明确打包需在管理员权限下执行（`winCodeSign` 解压需创建符号链接权限），避免打包中断。

## 新功能与体验增强

- feat(win): 桌面快捷方式、任务栏、开始菜单统一使用「极物聊天」品牌图标
- feat(nsis): 安装器、卸载器、安装向导头部图标统一为品牌图标

## 修复了以下问题

- fix(win): 修复安装后桌面图标为 Electron 默认图标的问题（`signAndEditExecutable` 由 `false` 改为 `true`）
- fix(build): 修复 `electron-builder` 提示 `default Electron icon is used reason=application icon is not set` 的问题
- fix(repo): 修复前端项目文件散落于仓库根目录、`electron-builder` 报 `Cannot find package.json` 的问题

## 构建与发布优化

- chore(build): 规范 `package.json` 中 `build.win` 与 `build.nsis` 的图标配置
- chore(repo): 恢复 `JiWu-chat-app`（前端）/ `JiWu-chat-node`（后端）前后端分离目录结构
- chore(clean): 打包前清理旧 `release` 产物，避免图标与安装包缓存残留

## 下载

各平台安装包见下表，实际可用资源以 Release 页面为准。

| 平台                       | 下载地址                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Windows x64 安装程序       | [JiwuChat_1.0.2_x64-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/JiwuChat_1.0.2_x64-setup.exe)   |
| Windows ia32 安装程序      | [JiwuChat_1.0.2_ia32-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/JiwuChat_1.0.2_ia32-setup.exe) |
| Windows 通用（x64 + ia32） | [JiwuChat_1.0.2-setup.exe](https://github.com/return-Liu/JiWuChat-Electron/releases/JiwuChat_1.0.2-setup.exe)           |

## 后续计划

沿用既有版本的待办，以下内容不属于本次交付：

- 本地消息存储
- 用户版本埋点
