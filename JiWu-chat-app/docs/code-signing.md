# Windows 代码签名配置指南（解决"未知发布者"）

## 问题现象

安装 `JiwuChat_x.x.x_x64-setup.exe` 时，Windows 弹出：

> **Windows 已保护你的电脑**
> 无法验证此应用的发布者 / 未知发布者

原因：安装包（NSIS exe）和主程序 `极物聊天.exe` **没有数字签名**。
Windows SmartScreen 无法验证发布者身份，因此显示"未知发布者"警告。

---

## 根本解决方案：购买代码签名证书

要彻底消除"未知发布者"，必须为 exe 使用**受信任 CA 签发的代码签名证书**。

### 1. 证书类型选择

| 类型 | 价格（参考） | SmartScreen 表现 | 说明 |
| --- | --- | --- | --- |
| **OV 代码签名证书** | ¥1500–3000/年 | 需累积下载量才消除警告 | 普通组织验证 |
| **EV 代码签名证书** | ¥3000–6000/年 | **立即**获得信任，无警告 | 推荐，需硬件令牌/USB Key |
| 自签名证书 | 免费 | **无效**，仍显示未知发布者 | 仅本地测试用 |

> **推荐 EV 证书**：EV 证书基于硬件令牌，签发后 SmartScreen 立即信任，无需等待下载量累积。

### 2. 常见证书供应商

- DigiCert / Sectigo / GlobalSign（国际）
- 阿里云、腾讯云、沃通（国内，支持中文资料）

### 3. 拿到证书后如何配置

拿到证书后通常有两种形式：

#### 形式 A：`.pfx` / `.p12` 文件（OV 证书常见）

把证书文件放到安全位置（**不要提交到 Git**），然后设置环境变量后构建：

```powershell
# PowerShell
$env:CSC_LINK = "C:\certs\jiwu-code-signing.pfx"
$env:CSC_KEY_PASSWORD = "你的证书密码"
pnpm run electron:build:prod
```

#### 形式 B：硬件令牌 / USB Key（EV 证书）

EV 证书的私钥在硬件令牌中，无法导出为 pfx。需要：

1. 安装供应商提供的签名工具（如 SafeNet Authentication Client）
2. 配置 electron-builder 使用自定义签名工具：

```jsonc
// package.json -> build.win
"sign": "./scripts/sign-windows.js"
```

`scripts/sign-windows.js` 示例（调用供应商 CLI 签名）：

```js
const { execSync } = require("node:child_process");

exports.default = async function sign(configuration) {
  const file = configuration.path;
  // 以 SafeNet / DigiCert 工具为例，按供应商文档替换命令
  execSync(`signtool sign /n "你的证书主题名" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "${file}"`, {
    stdio: "inherit",
  });
};
```

---

## 验证签名是否生效

构建完成后，用 `signtool` 检查：

```powershell
signtool verify /pa /v "release\win-unpacked\极物聊天.exe"
```

或在 Windows 资源管理器中：
- 右键 exe → **属性** → **数字签名** 标签页
- 应能看到你的证书信息

---

## 临时方案（不推荐用于正式发布）

如果暂时没有证书，可以：

1. **告知用户**：点击"更多信息" → "仍要运行"
2. **提交 SmartScreen 误报申诉**：https://www.microsoft.com/wdsi/filesubmission
3. **累积下载量**：OV 证书签名后，随下载量增加警告会逐渐消失

---

## 相关配置位置

- `package.json` → `build.win`：签名相关配置（`signingHashAlgorithms`、`rfc3161TimeStampServer`）
- 环境变量 `CSC_LINK` / `CSC_KEY_PASSWORD`：证书路径与密码（**切勿写进代码**）

## 注意事项

- ⚠️ **证书密码绝不要提交到 Git**，使用环境变量或 CI Secrets
- ⚠️ 时间戳服务器（`rfc3161TimeStampServer`）很重要：即使证书过期，已签名的包仍有效
- ⚠️ 签名后**不要**再修改 exe，否则签名失效
