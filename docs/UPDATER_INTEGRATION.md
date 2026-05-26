# Auto-Updater 集成说明

## 快速集成步骤

将以下代码添加到 `src/main/index.ts` 中：

### 1. 导入更新器模块

```typescript
// 在文件顶部添加
import { initializeUpdater, cleanupUpdater } from './services/UpdaterIntegration'
```

### 2. 在应用初始化时启动更新器

在 `app.whenReady()` 回调中添加（在创建主窗口之后）：

```typescript
void app.whenReady().then(async () => {
  // ... 其他初始化代码 ...
  
  const mainWindow = windowService.createMainWindow()
  
  // 初始化自动更新器
  await initializeUpdater()
  
  // ... 其他代码 ...
})
```

### 3. 在应用退出时清理

```typescript
app.on('will-quit', async () => {
  // ... 其他清理代码 ...
  cleanupUpdater()
})
```

---

## 完整集成示例

以下是修改后的 `src/main/index.ts` 关键片段：

```typescript
import { app } from 'electron'
import { initializeUpdater, cleanupUpdater } from './services/UpdaterIntegration'

// ... 其他导入 ...

void app.whenReady().then(async () => {
  // 记录当前版本
  versionService.recordCurrentVersion()

  // 其他初始化...
  initWebviewHotkeys()
  electronApp.setAppUserModelId(import.meta.env.VITE_MAIN_BUNDLE_ID || 'com.kangfenmao.CherryStudio')

  // 创建主窗口
  const mainWindow = windowService.createMainWindow()
  
  new TrayService()
  appMenuService?.setupApplicationMenu()

  // ✅ 初始化自动更新器（关键）
  await initializeUpdater()

  // ... 其他服务初始化 ...

  registerShortcuts(mainWindow)
  await registerIpc(mainWindow, app)

  // ... 其他代码 ...
})

// 应用退出时清理
app.on('will-quit', async () => {
  cleanupUpdater()  // ✅ 清理更新器
  
  // 其他清理代码...
  try {
    schedulerService.stopAll()
    await channelManager.stop()
    // ... 其他清理 ...
  } catch (error) {
    logger.warn('Error cleaning up services:', error)
  }

  logger.finish()
})
```

---

## 文件结构

集成后的项目结构：

```
src/main/
├── services/
│   ├── UpdaterService.ts           # 核心更新器服务
│   └── UpdaterIntegration.ts       # 集成助手（新）
├── ipc/
│   └── updater.ts                  # IPC 处理器
├── index.ts                        # 主入口（已修改）
└── ...

scripts/
├── publish-release.js              # 发布脚本（新）
└── ...

docs/
├── AUTO_UPDATER_GUIDE.md          # 详细指南（新）
└── UPDATER_INTEGRATION.md         # 本文件（新）

electron-builder.yml               # 已配置
```

---

## 验证集成

### 开发测试

```bash
# 1. 构建应用
pnpm run build

# 2. 启动应用
pnpm start

# 3. 检查控制台日志
# 应该看到：
# ✅ Auto-updater initialized successfully
# 或
# 📝 Checking for updates on startup
```

### 查看日志

在应用窗口中检查日志（如果启用了开发者工具）：

```javascript
// 在浏览器控制台中
// 查看 IPC 通信
window.electron.ipcRenderer.on('update-downloaded', (event, data) => {
  console.log('Update downloaded:', data)
})
```

---

## 渲染进程集成（可选）

如果需要在 UI 中显示更新状态，可以在渲染进程中添加：

```typescript
// src/renderer/src/hooks/useUpdater.ts

import { ipcRenderer } from 'electron'
import { useEffect, useState } from 'react'

export function useUpdater() {
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'downloading' | 'ready' | 'idle'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null)

  useEffect(() => {
    // 监听更新下载完成
    ipcRenderer.on('update-downloaded', (event, data) => {
      setUpdateStatus('ready')
      setUpdateInfo(data)
    })

    return () => {
      ipcRenderer.removeAllListeners('update-downloaded')
    }
  }, [])

  const checkForUpdates = async () => {
    setUpdateStatus('checking')
    const result = await ipcRenderer.invoke('updater:check')
    setUpdateStatus('idle')
    return result
  }

  const installUpdate = () => {
    ipcRenderer.invoke('updater:install')
  }

  return {
    updateStatus,
    updateInfo,
    checkForUpdates,
    installUpdate
  }
}
```

在 UI 组件中使用：

```tsx
// src/renderer/src/components/UpdateNotification.tsx

import { useUpdater } from '../hooks/useUpdater'

export function UpdateNotification() {
  const { updateStatus, updateInfo, installUpdate } = useUpdater()

  if (updateStatus !== 'ready') {
    return null
  }

  return (
    <div className="update-notification">
      <p>新版本已下载：{updateInfo?.version}</p>
      <button onClick={installUpdate}>立即安装并重启</button>
    </div>
  )
}
```

---

## 故障排查

### 问题：更新器未初始化

**症状**：控制台没有看到 `Auto-updater initialized successfully` 日志

**解决**：
1. 检查导入是否正确
2. 确保 `initializeUpdater()` 在窗口创建后调用
3. 查看是否有错误日志

### 问题：IPC 处理器不工作

**症状**：调用 `ipcRenderer.invoke('updater:check')` 没有响应

**解决**：
1. 确保 `registerUpdaterIpc()` 被调用
2. 检查 IPC 处理器是否在主进程中正确注册
3. 验证消息名称匹配 (`updater:check` 等)

### 问题：更新检查返回错误

**症状**：`updateInfo.error` 不为空

**解决**：
1. 检查网络连接
2. 验证 `publish` URL 配置正确
3. 确保更新文件已上传到服务器

---

## 配置项

在 `UpdaterService` 中可以自定义行为：

```typescript
// src/main/services/UpdaterService.ts

// 自动检查间隔（毫秒）
const CHECK_INTERVAL = 60 * 60 * 1000  // 1 小时

// 自动安装延迟（毫秒）
const AUTO_INSTALL_DELAY = 5 * 60 * 1000  // 5 分钟

// 启用自动检查
autoUpdater.checkForUpdatesAndNotify()
```

---

## 性能优化建议

1. **启用增量更新**
   - 已在 `electron-builder.yml` 中配置
   - 减少 70-90% 的下载量

2. **后台下载**
   - 用户可继续工作
   - 5 分钟后自动安装

3. **条件检查**
   - 只在生产环境检查
   - 开发环境跳过更新检查

---

## 下一步

1. ✅ 应用上述集成步骤
2. 🧪 在开发环境中测试
3. 📦 构建 Windows 包进行测试
4. 🚀 发布到 GitHub Releases 或服务器
5. 📊 监控用户反馈

---

**文档版本**: 1.0  
**最后更新**: 2026-05-26  
**适用于**: Cherry Studio v1.9.6+
