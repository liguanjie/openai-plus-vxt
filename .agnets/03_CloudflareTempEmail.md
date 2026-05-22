# Cloudflare Temp Email 集成方案

本文档汇总了在 `openai-plus-vxt` 项目中移植并集成 **Cloudflare Temp Email** 临时邮箱生成及验证码自动轮询接收功能的具体方案与技术细节。

---

## 需求背景

在自动化账号注册流程中，为避免使用固定邮箱账号，需要能够动态申请临时邮箱地址，并在验证码页面自动轮询获取注册邮件中的验证码 (OTP)。
为了实现这套闭环，我们将 `GuJumpgate` 项目中的 Cloudflare Temp Email 相关功能全量移植并适配到 `openai-plus-vxt` 插件中。

### 核心挑战
1. **CSP 策略限制**：目标注册网站（如 `chatgpt.com`）往往开启了严格的 `Content Security Policy (CSP)`，限制从网页端直接向用户自定义的 Cloudflare Worker 域名（如 `https://temp-email-worker.xxx.workers.dev`）发起 fetch 请求。
2. **跨域代理**：所有的 API 接口（邮箱生成、域名同步、邮件拉取）必须在插件的 `background` 服务层（Service Worker）中以消息代理的形式异步发起，以彻底避开前端站点的跨域及 CSP 安全沙箱阻碍。
3. **数据一致性**：由于新增了十余个配置属性（API 地址、Admin Auth、Custom Auth、查信模式、自定义子域等），必须将其与插件现有的 `browser.storage.local` 存储系统、State 自动归一化逻辑完美结合。

---

## 具体修改内容及文件清单

### 1. 编译配置更新 (CORS 赋权)
* **修改文件**：[`wxt.config.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/wxt.config.ts)
* **实现逻辑**：
  在 `manifest.host_permissions` 数组中添加 `"<all_urls>"`。由于用户配置的 Cloudflare Worker 域名通常是动态的、各不相同的，这一通配符能够确保 Service Worker 在后台拥有通用的跨域请求权限。

### 2. 状态定义与归一化
* **修改文件**：[`src/features/register/types.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/features/register/types.ts)
* **修改文件**：[`src/app/state.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/app/state.ts)
* **实现逻辑**：
  - 在 `RegisterState` 中扩展并定义 `cfTempEmailService`、`cfTempEmailGenerator`、`cfTempEmailApi` 等 11 个参数，用于全面支持临时邮箱的所有配置项。
  - 在 `state.ts` 的 `DEFAULT_REGISTER_STATE` 中补充默认值，并在 `normalizeRegisterState` 中进行完备的类型防御、保底回填及选项格式化。

### 3. 后台消息传递与代理路由
* **修改文件**：[`entrypoints/background.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/entrypoints/background.ts)
* **实现逻辑**：
  - 定义 `opx:fetch-temp-email-domains`、`opx:generate-temp-email` 和 `opx:wait-temp-email-otp` 三个新增消息的类型及消息过滤守护（Type Guards）。
  - 在 `chrome.runtime.onMessage.addListener` 中添加相应的条件路由分支，将页面发来的消息重定向到 background proxy fetch。

### 4. 纯 TypeScript 的 Cloudflare API 解析助手
* **新建文件**：[`src/features/register/temp-email.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/features/register/temp-email.ts)
* **实现逻辑**：
  从零移植并实现了轻量级 MIME 编解码解析、Base64 / Quoted-printable 解密、字符集转换工具，能够智能应对 Cloudflare Worker 返回的任意复杂邮件 MIME 格式；提供验证码数字提取正则表达式；提供多级回退的域名同步及地址分配模块。

### 5. Controller 桥接层构建
* **修改文件**：[`src/features/register/controller.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/features/register/controller.ts)
* **实现逻辑**：
  在 `createRegisterController` 的返回体中实现三大对接方法：
  - `syncTempEmailDomains()`：向 background 发送获取域名消息，并将返回的域名列表及首选域名写入 State。
  - `generateTempEmailAddress()`：触发临时邮箱分配，完成后自动回填至注册邮箱输入区，并自动更新 State。
  - `waitForTempEmailOtp()`：在当前为验证码页时，发送消息轮询 API。一旦收到，立刻调用 `fillOtpAndContinue` 填入网页并提交。

### 6. UI 配置控制台与动作绑定
* **修改文件**：[`src/features/register/panel.ts`](file:///d:/02_ben_work/02_ai/01_openai/openai-plus-vxt/src/features/register/panel.ts)
* **实现逻辑**：
  - 顶层添加 `邮箱服务` 和 `邮箱生成` 两组自适应下拉栏，支持 Outlook 模式与 Cloudflare 模式任意组合。
  - 当启用 Cloudflare 临时邮箱时，自动展示 `Cloudflare Temp Email 配置` 折叠块（细节容器 `details`）。
  - 折叠块内包含输入框、带有一键开关的密码可见性切换组件（👁️/🔒）、查信方式选项 Tab 组、隐藏/展现逻辑绑定的输入字段。
  - 邮箱生成选中为临时邮箱时，注册邮箱输入框高度自适应右侧的 `生成 Temp` 侧边按钮。
  - 将 `自动接收并填入验证码` 逻辑与 Controller 中的轮询接口绑定，界面会显示轮询挂起 pending 状态。

---

## 验证与发布

1. **TypeScript 编译**：
   ```bash
   npm run compile
   ```
   *状态：通过（所有类型对接无冲突）。*

2. **本地环境构建**：
   ```bash
   npm run build
   ```
   *状态：打包生成 `.output` 无报错。*
