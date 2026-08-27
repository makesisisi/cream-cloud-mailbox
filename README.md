# 奶油云朵信箱

一个温暖、轻松的匿名心理倾诉网站原型。当前已经包含首页、注册与登录、用户/管理员角色区分、匿名代号、用户会话页、管理员收件箱与双向回复流程。

## 在线地址

- 网站：[https://yunxinxiang.netlify.app](https://yunxinxiang.netlify.app)
- GitHub：[makesisisi/cream-cloud-mailbox](https://github.com/makesisisi/cream-cloud-mailbox)

## 当前实现

- 首页采用“奶油云朵信箱”视觉方向，桌面与移动端均可使用。
- 本地演示认证默认启用，注册用户只能成为普通用户。
- 管理员只看到会话匿名代号，不显示用户注册邮箱。
- 用户和管理员的消息保存在同一浏览器的 `localStorage`，便于当前阶段完整演示。
- 已接入 `@netlify/identity` 生产适配层，并准备好 Netlify 构建配置。
- Product Design 的 Sites 运行时文件保留在 `app/.openai`、`app/worker` 和 `app/scripts`，后续可以继续交给 Sites 发布。

## 本地运行

```powershell
cd app
npm.cmd install
npm.cmd run dev
```

本地模式无需外部账号或密钥。

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
npm.cmd run test:sites
```

## Netlify 准备

仓库根目录的 `netlify.toml` 已配置：

- Base directory：`app`
- Build command：`npm run build`
- Publish directory：`dist/client`
- Node.js：20
- SPA 路由回退与基础安全响应头
- 生产与 Deploy Preview 使用 `VITE_AUTH_MODE=netlify`

部署前需要在 Netlify 项目中执行：

1. 在 **Project configuration > Identity** 启用 Netlify Identity。
2. 注册模式设为 Open，并保留邮箱确认。
3. 普通注册用户默认视为 `client`。
4. 只在 Netlify 管理端为倾听员账号添加 `admin` 角色；前端注册页不会提供角色选择。
5. 使用 Deploy Preview 验证注册、邮箱确认、登录和退出。Netlify Identity 不能仅靠本地 `netlify dev` 完整验证。

## 上线前仍需完成

当前匿名对话的持久化属于本地演示，不是生产数据库。正式上线前需要把 `src/data/chatStore.js` 替换为受服务端权限保护的消息 API，并接入 Netlify Database/Postgres；管理员权限和“只能读取自己会话”的规则必须在服务端再次校验，不能只依赖页面路由。

同时建议补充消息保留期限、删除申请、管理员审计日志、限流、备份恢复和危机求助流程。

## GitHub 状态

当前目录已经是本地 Git 仓库，但本阶段没有创建远程仓库、没有推送，也没有执行提交。
