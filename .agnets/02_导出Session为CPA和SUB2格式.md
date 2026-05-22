# Session 导出为 CPA 和 SUB2 格式方案

本文档汇总了在 `openai-plus-vxt` 项目中集成 ChatGPT Session 导出为 CPA JSON 及 SUB2 JSON 格式的功能实现和界面调整细节。

---

## 调整背景与需求

为了便于用户将 ChatGPT Web 端的登录 Session 导出到其他工具（如 CPA-NORT 格式或 Sub2API 导入格式）中使用，需要实现：
1. **保留原始会话数据**：在通过 `/api/auth/session` 获取会话时，需要保留最原始的完整 JSON 负载，因为 CPA 导出工具需要解析其中的 expires 等时间戳信息和 JWT 内部字段（而之前的简化结构过滤掉了这些内容）。
2. **本地直接导出下载**：直接在前端面板通过 Blob 形式生成并触发浏览器下载，不需要经过任何后端，保证 Token 安全性。
3. **CPA JSON 格式转换**：
   - 提取并转换 expires 到 ISO 格式的 `expired` 字段。
   - 解析 `accessToken` 中的 JWT 声明以提取 `email`、`accountId` 和 `userId`。
   - 如果会话中没有 `id_token`，自动根据已解析的 `email`、`accountId`、`planType`、`userId` 字段，采用 JWT Header 带有 `cpa_synthetic: true` 的声明合成一个本地合规的 synthetic `id_token`。
   - 生成符合规范的 `codex-<email>-<plan>.json` 格式文件。
4. **SUB2 JSON 格式转换**：
   - 导出完整的 JSON 对象（包含 `accessToken`、`user`、`account` 等原始信息），移除了为 CPA 引入的 `raw` 嵌套字段以避免数据冗余。
   - 自动生成 `sub2api-<email>.json` 格式文件。
5. **UI 面板集成**：
   - 提链接 (JP) 面板的“读取 ChatGPT session”原按钮拆分为一行三列按钮组：“读取 session”、“导出 CPA”、“导出 SUB2”，自适应排列。

---

## 具体修改内容及文件清单

### 1. 扩展 Session 类型定义
* **修改文件**：[`src/features/link-extractor/types.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/features/link-extractor/types.ts)
* **实现逻辑**：
  在 `ChatGptSessionInfo` 接口中，增加可选的 `raw?: Record<string, unknown>` 字段，用于存放 `/api/auth/session` 返回的原始 JSON 数据。

### 2. 后端脚本保留原始 Session Payload
* **修改文件**：[`entrypoints/background.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/entrypoints/background.ts)
* **实现逻辑**：
  在 `fetchChatGptSessionInTab` 的 `extractSessionInfo` 内部，在返回的对象中增加 `raw: data`，确保 background script 能将 ChatGPT 返回的完整 JSON 对象回传给 popup。

### 3. 创建导出逻辑转换模块 (TypeScript 版本)
* **新建文件**：[`src/features/link-extractor/exporter.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/features/link-extractor/exporter.ts)
* **实现逻辑**：
  - 实现 `exportCpaSessionJson(session)`：
    - 读取 `accessToken`，解析 JWT 载荷以获取 `exp`。
    - 智能提取 `email`、`accountId`、`userId`、`planType` 等字段。
    - 针对缺失 `id_token` 的账号，实现 `buildSyntheticCodexIdToken` 辅助函数以合成格式正确的 Codex IdToken。
    - 组装成合规的 CPA JSON 数据格式，并自动生成诸如 `codex-username-chatgptplusplan.json` 的文件名。
  - 实现 `exportSub2SessionJson(session)`：
    - 拷贝 session 数据，剥离 nested `raw` 对象，确保体积精简，输出为 `sub2api-username.json`。
  - 内置 base64url 解密和加密工具，完全兼容现代浏览器和 Node.js（使用 `Buffer` 或 `TextEncoder/TextDecoder`/`atob`/`btoa` 兼容环境）。

### 4. 界面集成与下载事件绑定
* **修改文件**：[`src/features/link-extractor/panel.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/features/link-extractor/panel.ts)
* **实现逻辑**：
  - 将原来的单个 `refreshSessionButton` 按钮替换为包含三个按钮（“读取 session”、“导出 CPA”、“导出 SUB2”）的 `.opx-button-row` 网格容器。
  - 在内存中声明 `currentSessionObject` 变量，在 `refreshSession()` 成功拉取数据时保存最完整的 Session Payload。
  - 绑定 `handleExport(format)` 逻辑：若内存中没有 Session 则触发刷新；获取到数据后通过 `downloadTextFile()` 触发客户端的 Blob 下载。
  - 实现了 `downloadTextFile(content, fileName)` 帮助函数，用于生成临时 `a` 标签并点击，支持纯前端文件流下载。

---

## 验证与发布

1. **TypeScript 编译**：
   ```bash
   npm run compile
   ```
   *状态：成功通过（已修复 isPlainObject 类型推导引起的 TS2339 错误）。*

2. **生产构建与打包**：
   ```bash
   npm run build
   ```
   *状态：打包流程无报错，在 `.output/` 目录下成功编译出扩展包。*
