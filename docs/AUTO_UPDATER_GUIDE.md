# Electron-Builder Auto-Updater 实施指南

## 概述

本指南为 Cherry Studio (v1.9.6 Windows x64) 实施完整的自动更新功能。使用 electron-builder 和 electron-updater，支持增量更新、自动检测、后台下载。

---

## 📋 已配置的组件

### 1. **UpdaterService** (`src/main/services/UpdaterService.ts`)
核心更新管理服务，负责：
- 初始化 `electron-updater` 
- 监听更新事件（下载、安装、错误）
- 管理更新状态和生命周期
- 自动安装或延迟安装

### 2. **IPC 处理器** (`src/main/ipc/updater.ts`)
主进程与渲染进程通信：
- `updater:check` - 手动检查更新
- `updater:status` - 获取更新状态
- `updater:install` - 立即安装并重启

### 3. **electron-builder 配置** (`electron-builder.yml`)
关键配置：
```yaml
# Windows 配置
win:
  executableName: Cherry Studio
  artifactName: ${productName}-${version}-${arch}-setup.${ext}
  target:
    - target: nsis        # 网络安装程序
    - target: portable    # 便携式版本

# 发布配置
publish:
  provider: generic       # GitHub 或自定义服务器
  url: https://releases.cherry-ai.com

# 更新脚本
beforePack: scripts/before-pack.js
afterPack: scripts/after-pack.js
artifactBuildCompleted: scripts/artifact-build-completed.js
```

---

## 🚀 快速开始

### 前置条件
```bash
# Node 版本
node >= 24.11.1

# 依赖已安装
pnpm install
```

### 构建 Windows x64 安装包

```bash
# 构建单个架构（推荐用于发布）
pnpm run build:win:x64

# 或构建所有 Windows 架构
pnpm run build:win

# 输出文件位置
dist/
├── Cherry-Studio-1.9.6-x64-setup.exe     # NSIS 安装程序
└── Cherry-Studio-1.9.6-x64-portable.exe  # 便携式版本
```

### 发布新版本

```bash
# 方式 1: 使用发布脚本（推荐）
pnpm run publish

# 方式 2: 手动发布
node scripts/publish-release.js 1.10.0

# 预发布版本
node scripts/publish-release.js 1.10.0-beta.1 --pre
```

---

## 📝 配置说明

### electron-builder.yml 关键配置

```yaml
# 应用信息
appId: com.kangfenmao.CherryStudio
productName: Cherry Studio

# Windows NSIS 配置
nsis:
  artifactName: ${productName}-${version}-${arch}-setup.${ext}
  shortcutName: ${productName}
  createDesktopShortcut: always
  allowToChangeInstallationDirectory: true
  oneClick: false  # 允许用户选择安装路径
  differentialPackage: false

# 便携式版本
portable:
  artifactName: ${productName}-${version}-${arch}-portable.${ext}

# 发布配置（重要）
publish:
  provider: generic  # 使用 GitHub Releases
  url: https://releases.cherry-ai.com
```

### 文件过滤

排除以下文件减小包体积：
- 源代码 (`src/`, `scripts/`)
- 配置文件 (`.env*`, `tsconfig.json`, `.eslintrc*`)
- 测试文件 (`**/*.test.ts`, `**/__tests__/**`)
- 依赖开发工具 (`rollup-plugin-visualizer`, `js-tiktoken`)

---

## 🔄 更新流程

### 用户侧流程

```
1. 应用启动
   ↓
2. UpdaterService 初始化，检查更新
   ↓
3. 如有更新可用
   ├─→ 后台下载更新包 (增量更新)
   ├─→ 下载完成后通知用户
   └─→ 用户选择安装 或 5分钟后自动安装
   ↓
4. 应用退出并重启
   ↓
5. 安装新版本
   ↓
6. 启动新版本应用
```

### 开发侧流程

```
1. 修改代码
   ↓
2. 更新 package.json 版本号
   ↓
3. 提交代码并创建 git tag
   ↓
4. 构建应用
   pnpm run build:win:x64
   ↓
5. 生成发布文件
   dist/*.exe
   dist/*.exe.blockmap  # 增量更新信息
   dist/latest.yml      # 更新元数据
   ↓
6. 上传到 GitHub Releases
   ↓
7. 用户获得更新通知
```

---

## 🔐 Windows 代码签名（可选）

### 配置签名

编辑 `electron-builder.yml`:

```yaml
win:
  certificateFile: path/to/certificate.pfx
  certificatePassword: ${WINDOWS_CERT_PASSWORD}
  signingHashAlgorithms: [sha256]
  
  # 或使用自定义签名脚本
  signtoolOptions:
    sign: scripts/win-sign.js
```

### 创建签名脚本 (`scripts/win-sign.js`)

```javascript
// 使用 Azure Key Vault 或本地证书
const { execSync } = require('child_process')

module.exports = async (configuration) => {
  const files = configuration.signFiles
  
  for (const file of files) {
    execSync(`signtool sign /f certificate.pfx /p ${process.env.CERT_PASSWORD} /t http://timestamp.digicert.com "${file}"`)
  }
}
```

---

## 📦 发布到自定义服务器

### 修改发布 URL

```yaml
publish:
  provider: generic
  url: https://your-server.com/updates/  # 替换为你的服务器
```

### 服务器文件结构

```
/updates/
├── latest.yml              # 最新版本信息
├── Cherry-Studio-1.10.0-x64-setup.exe
├── Cherry-Studio-1.10.0-x64-setup.exe.blockmap
├── Cherry-Studio-1.9.6-x64-setup.exe
└── Cherry-Studio-1.9.6-x64-setup.exe.blockmap
```

### 生成 latest.yml

```bash
# electron-builder 自动生成，内容示例：
version: 1.10.0
files:
  - url: Cherry-Studio-1.10.0-x64-setup.exe
    sha512: abc123def456...
    size: 123456789
    blockMapSize: 12345
path: Cherry-Studio-1.10.0-x64-setup.exe
sha512: abc123def456...
releaseDate: '2026-05-26T00:00:00Z'
```

---

## 🛠️ 故障排除

### 问题 1: 更新检查失败
```typescript
// 检查网络连接和发布 URL
const status = await updaterService.checkForUpdates()
if (status.error) {
  console.error('Update check failed:', status.error)
  // 处理错误
}
```

### 问题 2: 增量更新不工作
```yaml
# 确保 blockmap 文件存在
# 检查 electron-builder.yml 中的 differentialPackage 为 false
nsis:
  differentialPackage: false
```

### 问题 3: 启用调试日志
```typescript
// UpdaterService 中启用日志
autoUpdater.logger = logger  // 已配置
autoUpdater.logger.info('Update process started')
```

---

## 📊 性能优化

### 增量更新
```yaml
# blockmap 启用（默认）
# 只下载变化的部分，减少下载大小 70-90%
asarUnpack:
  - out/proxy/**
  - resources/**
  - "**/*.{metal,exp,lib}"
```

### 后台下载
```typescript
// UpdaterService 中实现
// 用户可继续工作，5分钟后自动安装
this.scheduleUpdateInstall()  // 5 分钟延迟
```

---

## 📋 检查清单

构建发布前的验证：

- [ ] 更新 `package.json` 版本号
- [ ] 创建 git tag (`v1.10.0`)
- [ ] 运行 `pnpm build:check` 通过所有检查
- [ ] 构建 Windows 包 (`pnpm run build:win:x64`)
- [ ] 验证输出文件 (`dist/*.exe`, `dist/*.blockmap`)
- [ ] 上传到 GitHub Releases 或自定义服务器
- [ ] 测试更新流程：
  - [ ] 手动检查更新
  - [ ] 后台下载更新
  - [ ] 安装更新后验证版本号
  - [ ] 检查应用正常运行

---

## 📚 参考资源

- [electron-builder 官方文档](https://www.electron.build/)
- [electron-updater 文档](https://github.com/electron-userland/electron-builder/tree/master/packages/electron-updater)
- [Electron 更新指南](https://www.electronjs.org/docs/latest/)

---

## 🔗 相关命令

```bash
# 开发和测试
pnpm dev                    # 开发模式
pnpm build:check           # 检查构建
pnpm build:win:x64         # 构建 Windows x64

# 发布和更新
pnpm publish               # 完整发布流程
node scripts/publish-release.js 1.10.0  # 发布指定版本

# 清理
rm -rf dist out            # 清理构建输出
```

---

**最后更新**: 2026-05-26
**版本**: 1.9.6 → 1.10.0+
