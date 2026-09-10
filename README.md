# 奶油云朵信箱

一个温暖、轻松的匿名心理倾诉网站。当前已经包含首页、注册与登录、用户/管理员角色区分、匿名代号、用户会话页、管理员收件箱，以及由 Netlify Functions、Netlify Database 和 Netlify Blobs 支持的跨设备双向回复与私密图片流程。

## 在线地址

- 网站：[https://yunxinxiang.netlify.app](https://yunxinxiang.netlify.app)
- GitHub：[makesisisi/cream-cloud-mailbox](https://github.com/makesisisi/cream-cloud-mailbox)

## 当前实现

- 首页采用“奶油云朵信箱”视觉方向，桌面与移动端均可使用。
- 本地运行默认启用演示认证；线上使用 Netlify Identity，公开注册用户只能成为普通用户。
- 线上匿名代号由服务端随机生成。管理员 API 不返回用户邮箱、Identity 用户 ID 或登录身份。
- 线上会话和消息保存在 Netlify Database；服务端会再次校验“普通用户只能访问自己的会话、管理员可以处理全部会话”。
- 写请求会校验同源请求，消息长度限制为 4000 字符，API 响应禁用缓存。
- 用户端与管理员端每 10 秒自动刷新一次，也会在发送消息和重新切回页面时刷新。
- 会话双方可以发送 JPG、PNG、WebP 图片（每张不超过 4 MB）。图片保存在私有 Blobs 中，读取接口会再次校验会话权限，不生成公开地址。
- 倾诉者开启 AI 辅助后，最新一条倾诉中的图片会与最近对话一起交给服务端模型分析；关闭授权时正常图片聊天仍然可用。
- 文本分析默认使用 V4 Flash；图片消息直接使用 `deepseek-v4-flash-vision-exp`。服务端将 AI 图片预览缩至最长边 768 像素、最多 48 KiB，保留聊天原图，避免网关请求大小超限。

Windows 本地发布时，先执行 `npm --prefix app install --os=linux --cpu=x64 --libc=glibc --include=optional --ignore-scripts`，再执行 `netlify deploy --prod`，确保 Sharp 的 Linux 原生组件进入函数包。发布后执行 `npm --prefix app install --include=optional --ignore-scripts` 恢复 Windows 本地依赖。Netlify 云端 Linux 构建会自动安装对应组件。
- Identity 邀请链接会打开站内密码设置页，使用 `acceptInvite` 完成账号启用后再按角色进入工作台。
- Product Design 的 Sites 运行时文件保留在 `app/.openai`、`app/worker` 和 `app/scripts`，后续可以继续交给 Sites 发布。

## 本地运行

```powershell
cd app
npm.cmd install
npm.cmd run dev
```

本地模式无需外部账号或密钥，聊天数据保存在浏览器 `localStorage`，仅用于演示。生产数据不会走这个本地存储分支。

### 演示账号

| 角色 | 邮箱 | 密码 |
|---|---|---|
| 普通用户 | `user@cloudmail.local` | `User123!` |
| 管理员 | `admin@cloudmail.local` | `Admin123!` |

登录页也提供“填入用户账号”和“填入管理员账号”按钮。

## 验证命令

```powershell
cd app
npm.cmd run build
npm.cmd test
```

## Netlify 准备

仓库根目录的 `netlify.toml` 已配置：

- Build command：`npm --prefix app run build`
- Publish directory：`app/dist/client`
- Functions directory：`app/netlify/functions`
- Node.js：20
- SPA 路由回退与基础安全响应头
- 生产与 Deploy Preview 使用 `VITE_AUTH_MODE=netlify`
- 数据库迁移位于 `netlify/database/migrations`

线上配置：

1. Netlify Identity 已启用，注册模式为 Open；是否要求邮箱确认由 Netlify Identity 项目设置决定，前端同时兼容自动确认和待确认返回。
2. `identity.mjs` 会给普通注册用户分配 `client` 角色。
3. 只在 Netlify 管理端为倾听员账号添加 `admin` 角色；前端注册页不会提供角色选择。
4. Netlify Database 会在部署时应用版本化 SQL 迁移。

## 当前限制与后续事项

- 管理员账号与 `admin` 角色已经配置；发布后仍应使用无敏感内容的测试图片做一次真实跨角色验收。
- 当前为轻量 MVP，尚未实现消息保留期限、用户自助删除申请、管理员审计日志和应用级限流。
- 图片附件当前随会话记录保留；正式开放给更多用户前，应补充保留期限和用户删除机制。
- Netlify Database 默认不属于 HIPAA 合规环境，请勿把本站宣传为医疗服务，也不要收集受监管的医疗档案或可识别身份信息。
- 本站不是紧急救援渠道；页面持续展示 110、120 与全国统一心理援助热线 12356。

## GitHub 状态

仓库已公开发布到 [makesisisi/cream-cloud-mailbox](https://github.com/makesisisi/cream-cloud-mailbox)，`main` 分支与 Netlify 连续部署连接。
