import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ChatCircleDots,
  ChatsCircle,
  CheckCircle,
  Cloud,
  Eye,
  EyeSlash,
  Heart,
  House,
  Leaf,
  LockKey,
  List,
  PaperPlaneTilt,
  PlusCircle,
  ShieldCheck,
  SignIn,
  SignOut,
  Sparkle,
  UserCircle,
  UsersThree,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { demoAccounts } from "./auth/authService.js";
import {
  closeConversation,
  createConversation,
  retryAiAnalysis,
  sendMessage,
  setAiAssistance,
  useConversations,
} from "./data/chatStore.js";
import {
  formatConversationDate,
  formatListTime,
  formatTime,
  getGreeting,
  getMessagePerspectiveClass,
  groupMessagesByDate,
} from "./utils/presentation.js";

const tips = [
  {
    category: "情绪照顾",
    title: "先给情绪留出五分钟",
    body: "不急着分析对错，只试着说出：我现在感到什么。",
    color: "peach",
  },
  {
    category: "温柔练习",
    title: "把今天缩小一点",
    body: "当事情太多时，只选择下一件最小、最具体的事。",
    color: "sage",
  },
  {
    category: "睡前放松",
    title: "用呼吸结束忙碌",
    body: "吸气四拍，停一拍，呼气六拍，重复三次就好。",
    color: "sand",
  },
];

const statusLabels = {
  waiting: "等待倾听员回复",
  active: "正在沟通",
  closed: "已经结束",
};

const MAX_CHAT_IMAGE_SIZE = 4 * 1024 * 1024;

function validateChatImage(file) {
  if (!file) return "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "只支持 JPG、PNG 或 WebP 图片。";
  if (file.size > MAX_CHAT_IMAGE_SIZE) return "图片不能超过 4 MB。";
  return "";
}

function MessageContent({ message }) {
  return (
    <div className={`message-bubble ${message.attachments?.length ? "has-image" : ""}`}>
      {message.attachments?.map((attachment) => (
        <a className="message-image-link" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id} aria-label="查看对话图片原图">
          <img src={attachment.url} alt="对话中发送的图片" loading="lazy" decoding="async" />
        </a>
      ))}
      {message.body && <p className="message-body">{message.body}</p>}
    </div>
  );
}

function ComposerImagePreview({ file, previewUrl, onClear }) {
  if (!file || !previewUrl) return null;
  return (
    <div className="composer-image-preview">
      <img src={previewUrl} alt="待发送图片预览" />
      <div><strong>图片已准备好</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · 发送前仍可移除</span></div>
      <button type="button" onClick={onClear} aria-label="移除待发送图片"><XCircle size={20} /></button>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <Link className="brand" to="/" aria-label="奶油云朵信箱首页">
      <span className="brand-mark"><Cloud size={compact ? 24 : 30} weight="duotone" /></span>
      <span>
        <strong>奶油云朵信箱</strong>
        {!compact && <small>匿名倾诉 · 温柔陪伴</small>}
      </span>
    </Link>
  );
}

function SiteHeader() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <header className="site-header">
      <Brand />
      <nav className="main-nav" aria-label="主导航">
        <Link to="/">首页</Link>
        <Link to="/tips">心理小贴士</Link>
        <Link to="/about#how">倾听方式</Link>
        <Link to="/about">关于我们</Link>
      </nav>
      <div className="header-actions">
        {session ? (
          <>
            <Link className="soft-link user-entry" to={session.role === "admin" ? "/admin" : "/app"}>
              <UserCircle size={20} />
              <span>{session.role === "admin" ? "管理员工作台" : session.alias}</span>
            </Link>
            <button className="icon-button" type="button" onClick={handleLogout} aria-label="退出登录">
              <SignOut size={20} />
            </button>
          </>
        ) : (
          <Link className="soft-link" to="/login"><SignIn size={20} /> 登录</Link>
        )}
        <details className="mobile-menu">
          <summary aria-label="打开网站导航"><List size={22} /></summary>
          <nav aria-label="移动端导航">
            <Link to="/">首页</Link>
            <Link to="/tips">心理小贴士</Link>
            <Link to="/about#how">倾听方式</Link>
            <Link to="/about">关于我们</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

function HomePage() {
  const { session } = useAuth();
  const startPath = session ? (session.role === "admin" ? "/admin" : "/app") : "/register";

  return (
    <div className="page page-home">
      <SiteHeader />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow"><Heart size={17} weight="fill" /> 从这里开始，被温柔接住</span>
            <h1 id="hero-title">你可以慢慢说，<br />我们认真听。</h1>
            <p>注册后使用匿名代号，与倾听员安心聊聊。你的邮箱和真实身份不会显示在对话中。</p>
            <div className="hero-actions">
              <Link className="button button-primary" to={startPath}>
                <ChatCircleDots size={23} weight="fill" /> 开始匿名倾诉
              </Link>
              <Link className="button button-secondary" to="/tips">
                <Leaf size={21} /> 先看看心理小贴士
              </Link>
            </div>
            <div className="gentle-note"><Sparkle size={18} weight="fill" /> 不需要整理好情绪，想从哪里开始都可以。</div>
          </div>
          <div className="hero-art" aria-label="小熊把信放进云朵信箱的温暖插画">
            <img src="/assets/cloud-mailbox-hero-alpha.png" alt="小熊把一封信放进云朵形状的信箱" />
          </div>
        </section>

        <section className="trust-strip" id="listening" aria-labelledby="trust-title">
          <div className="comfort-copy">
            <span className="mini-illustration"><Heart size={34} weight="duotone" /></span>
            <div>
              <h2 id="trust-title">在这里，你可以放心做自己。</h2>
              <p>这不是诊断室，而是一段被认真倾听的时间。</p>
            </div>
          </div>
          <div className="trust-item"><UserCircle size={28} weight="duotone" /><div><strong>匿名表达</strong><span>仅显示随机代号</span></div></div>
          <div className="trust-item"><Heart size={28} weight="duotone" /><div><strong>温柔倾听</strong><span>陪伴、不评判</span></div></div>
          <div className="trust-item"><LockKey size={28} weight="duotone" /><div><strong>隐私优先</strong><span>不会公开聊天内容</span></div></div>
        </section>

        <section className="tips-section" id="home-tips" aria-labelledby="tips-title">
          <div className="section-heading">
            <span className="eyebrow"><Leaf size={17} /> 今天也照顾一下自己</span>
            <h2 id="tips-title">三条轻轻的小提醒</h2>
            <p>不是任务，也不需要全部做到。挑一条现在用得上的就好。</p>
          </div>
          <div className="tip-grid">
            {tips.map((tip) => (
              <article className={`tip-card tip-${tip.color}`} key={tip.title}>
                <span>{tip.category}</span>
                <h3>{tip.title}</h3>
                <p>{tip.body}</p>
                <Link to="/tips">慢慢读一读 <ArrowRight size={16} /></Link>
              </article>
            ))}
          </div>
        </section>

        <section className="safety-note" aria-label="紧急求助提醒">
          <ShieldCheck size={28} weight="duotone" />
          <p><strong>需要立即帮助？</strong> 本站不是紧急救援渠道。若你或他人正处于危险中，请拨打 110、120，或全国统一心理援助热线 12356。</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function TipsPage() {
  return (
    <div className="page">
      <SiteHeader />
      <main className="content-page">
        <div className="section-heading centered">
          <span className="eyebrow"><BookOpenText size={18} /> 云朵小贴士</span>
          <h1>给忙乱的心一点呼吸空间</h1>
          <p>这些内容用于日常自我照顾，不替代专业诊断或治疗。</p>
        </div>
        <div className="tips-library">
          {tips.concat([
            { category: "人际关系", title: "允许自己晚一点回复", body: "暂时没有力气回应时，先照顾好自己并不等于冷漠。", color: "peach" },
            { category: "自我接纳", title: "别用今天否定所有的你", body: "一个难熬的下午，不代表你一直都做得不好。", color: "sage" },
            { category: "压力调节", title: "把担心写成一句话", body: "写下最担心的事，再写下今天能做的最小一步。", color: "sand" },
          ]).map((tip) => (
            <article className={`tip-card tip-${tip.color}`} key={tip.title}>
              <span>{tip.category}</span><h2>{tip.title}</h2><p>{tip.body}</p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function AboutPage() {
  return (
    <div className="page">
      <SiteHeader />
      <main className="content-page about-page">
        <div className="section-heading centered">
          <span className="eyebrow"><Heart size={18} weight="fill" /> 关于奶油云朵信箱</span>
          <h1>让表达更容易，让倾听更认真</h1>
          <p>这里提供的是匿名表达与非评判式陪伴，不做心理诊断，也不替代医疗或心理咨询服务。</p>
        </div>

        <section className="about-grid" id="how" aria-labelledby="how-title">
          <div className="about-copy">
            <span className="eyebrow"><ChatsCircle size={18} /> 倾听方式</span>
            <h2 id="how-title">一段会话，会这样进行</h2>
            <p>注册后系统会为会话生成匿名代号。你可以先选择想聊的主题，再用自己的节奏写下感受；倾听员会先接住情绪，再通过问题陪你慢慢梳理。</p>
          </div>
          <ol className="process-list">
            <li><strong>创建会话</strong><span>只需选择大致主题和当下需要，不要求完整讲述。</span></li>
            <li><strong>匿名交流</strong><span>倾听员看到的是随机代号，不会看到你的注册邮箱。</span></li>
            <li><strong>随时暂停</strong><span>你可以晚一点回复，也可以主动结束会话并保留历史记录。</span></li>
          </ol>
        </section>

        <section className="privacy-section" id="privacy" aria-labelledby="privacy-title">
          <span className="eyebrow"><LockKey size={18} /> 隐私与安全</span>
          <h2 id="privacy-title">我们如何保护这段对话</h2>
          <div className="privacy-grid">
            <article><ShieldCheck size={28} weight="duotone" /><h3>权限隔离</h3><p>普通用户只能读取自己的会话，管理员只能通过受保护的工作台回复。</p></article>
            <article><UserCircle size={28} weight="duotone" /><h3>最少展示</h3><p>对话界面不展示邮箱、真实姓名或登录方式；也请不要主动发送可识别信息。</p></article>
            <article><Sparkle size={28} weight="duotone" /><h3>AI 辅助可选</h3><p>只有在你主动勾选后，AI才会分析本次对话的情绪线索。结果仅供倾听员参考，不会自动回复或作出诊断。</p></article>
            <article><WarningCircle size={28} weight="duotone" /><h3>服务边界</h3><p>本站不是紧急救援渠道。若存在即时危险，请拨打 110、120 或心理援助热线 12356。</p></article>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function PasswordField({ label, value, onChange, autoComplete = "current-password", placeholder = "至少 8 位" }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>{label}
      <span className="password-input">
        <input
          type={visible ? "text" : "password"}
          minLength={8}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "隐藏密码" : "显示密码"}>
          {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
        </button>
      </span>
    </label>
  );
}

function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { login, register, authMode, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const returnTo = typeof location.state?.from === "string" && location.state.from.startsWith("/")
    ? location.state.from
    : null;

  function destinationFor(nextSession) {
    const fallback = nextSession.role === "admin" ? "/admin" : "/app";
    if (!returnTo) return fallback;
    if (nextSession.role === "admin" || !returnTo.startsWith("/admin")) return returnTo;
    return fallback;
  }

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (isRegister) {
        const result = await register(form);
        if (result.needsConfirmation) setMessage("这个邮箱可能已经注册。请切换到登录页使用原密码，或通过“忘记密码”重新设置。");
        else navigate(destinationFor(result.session), { replace: true });
      } else {
        const session = await login(form.email, form.password);
        navigate(destinationFor(session), { replace: true });
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法完成，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  function useDemo(account) {
    setForm((current) => ({ ...current, email: account.email, password: account.password }));
  }

  if (session) return <Navigate to={destinationFor(session)} replace />;

  return (
    <div className="page auth-page">
      <SiteHeader />
      <main className="auth-layout">
        <section className="auth-intro">
          <span className="eyebrow"><Cloud size={18} weight="duotone" /> 匿名倾诉，从一个安全账号开始</span>
          <h1>{isRegister ? "给自己留一个，\n可以放心说话的地方。" : "欢迎回来，\n你的信箱还在这里。"}</h1>
          <p>账号用于保护你的对话和找回记录。倾听员只能看到匿名代号，不会看到注册邮箱。</p>
          <ul>
            <li><CheckCircle size={21} weight="fill" /> 注册用户默认只能进入用户端</li>
            <li><CheckCircle size={21} weight="fill" /> 管理员权限由服务端单独授予</li>
            <li><CheckCircle size={21} weight="fill" /> 对话中不展示真实身份</li>
          </ul>
        </section>
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card-heading">
            <span className="auth-icon">{isRegister ? <PlusCircle size={26} /> : <SignIn size={26} />}</span>
            <div><h2 id="auth-title">{isRegister ? "注册账号" : "登录账号"}</h2><p>{isRegister ? "邮箱、密码，再加一个可选称呼" : "继续之前的匿名会话"}</p></div>
          </div>
          <form onSubmit={submit}>
            {isRegister && (
              <label>称呼（选填，仅用于登录后的问候）
                <input value={form.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="例如：小云" autoComplete="nickname" />
              </label>
            )}
            <label>邮箱
              <input type="email" required value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@example.com" autoComplete="email" />
            </label>
            <PasswordField label="密码" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={isRegister ? "new-password" : "current-password"} />
            {!isRegister && <div className="auth-help-row"><Link to="/forgot-password">忘记密码？</Link></div>}
            {error && <div className="form-message error"><WarningCircle size={18} /> {error}</div>}
            {message && <div className="form-message info" role="status"><WarningCircle size={18} /> {message}</div>}
            <button className="button button-primary button-block" disabled={busy} type="submit">
              {busy ? "请稍等…" : isRegister ? "创建匿名账号" : "登录并继续"}
            </button>
          </form>
          {!isRegister && authMode === "demo" && (
            <div className="demo-accounts">
              <span>本地演示快捷登录</span>
              <div>
                {demoAccounts.map((account) => (
                  <button type="button" key={account.role} onClick={() => useDemo(account)}>
                    {account.role === "admin" ? <UsersThree size={18} /> : <UserCircle size={18} />}
                    填入{account.role === "admin" ? "管理员" : "用户"}账号
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="auth-switch">
            {isRegister ? "已经有账号？" : "还没有账号？"}
            <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "去登录" : "先注册"}</Link>
          </p>
        </section>
      </main>
    </div>
  );
}

function PasswordRecoveryRequestPage() {
  const { requestPasswordRecovery, authMode, session } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestPasswordRecovery(email);
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法发送找回邮件，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  if (session) return <Navigate to={session.role === "admin" ? "/admin" : "/app"} replace />;

  return (
    <div className="page auth-page">
      <SiteHeader />
      <main className="auth-layout auth-layout-compact">
        <section className="auth-intro">
          <span className="eyebrow"><LockKey size={18} /> 找回你的信箱</span>
          <h1>忘记密码没关系，<br />我们从邮箱重新开始。</h1>
          <p>输入注册邮箱后，我们会发送重置链接。为了保护账号，无论邮箱是否存在，页面都会显示相同结果。</p>
        </section>
        <section className="auth-card" aria-labelledby="recovery-title">
          <div className="auth-card-heading">
            <span className="auth-icon"><LockKey size={26} /></span>
            <div><h2 id="recovery-title">找回密码</h2><p>重置链接会发送到注册邮箱</p></div>
          </div>
          {sent ? (
            <div className="recovery-result" role="status">
              <CheckCircle size={34} weight="duotone" />
              <h3>请检查你的邮箱</h3>
              <p>{authMode === "demo" ? "本地演示不会真实发送邮件；线上环境会发送重置链接。" : "如果这个邮箱已注册，几分钟内会收到密码重置链接。也请检查垃圾邮件文件夹。"}</p>
              <Link className="button button-secondary" to="/login">返回登录</Link>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>注册邮箱
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" />
              </label>
              {error && <div className="form-message error"><WarningCircle size={18} /> {error}</div>}
              <button className="button button-primary button-block" disabled={busy} type="submit">{busy ? "正在发送…" : "发送重置链接"}</button>
              <Link className="auth-back-link" to="/login">返回登录</Link>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function PasswordResetPage() {
  const { completePasswordRecovery, clearAuthCallback } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("两次输入的密码不一致，请重新确认。");
      return;
    }
    setBusy(true);
    try {
      const session = await completePasswordRecovery(password);
      navigate(session.role === "admin" ? "/admin" : "/app", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "密码暂时无法更新，请重新打开邮件中的链接。");
      setBusy(false);
    }
  }

  return (
    <div className="page auth-page">
      <SiteHeader />
      <main className="auth-layout auth-layout-compact">
        <section className="auth-intro">
          <span className="eyebrow"><ShieldCheck size={18} /> 安全重置密码</span>
          <h1>设置一个新的，<br />只有你知道的密码。</h1>
          <p>建议至少 8 位，并避免与其他网站重复。更新完成后会直接回到你的信箱。</p>
        </section>
        <section className="auth-card" aria-labelledby="reset-title">
          <div className="auth-card-heading">
            <span className="auth-icon"><LockKey size={26} /></span>
            <div><h2 id="reset-title">设置新密码</h2><p>重置链接已验证</p></div>
          </div>
          <form onSubmit={submit}>
            <PasswordField label="新密码" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            <PasswordField label="再次输入新密码" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="再次输入相同密码" />
            {error && <div className="form-message error"><WarningCircle size={18} /> {error}</div>}
            <button className="button button-primary button-block" disabled={busy} type="submit">{busy ? "正在更新…" : "更新密码并进入信箱"}</button>
            <button className="auth-back-link button-link" type="button" onClick={() => { clearAuthCallback(); navigate("/login", { replace: true }); }}>取消并返回登录</button>
          </form>
        </section>
      </main>
    </div>
  );
}

function InviteAcceptPage({ token }) {
  const { completeInvite } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("两次输入的密码不一致，请重新确认。");
      return;
    }
    setBusy(true);
    try {
      const session = await completeInvite(token, password);
      navigate(session.role === "admin" ? "/admin" : "/app", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "邀请暂时无法接受，请重新打开邮件中的链接。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page auth-page">
      <SiteHeader />
      <main className="auth-layout">
        <section className="auth-intro">
          <span className="eyebrow"><ShieldCheck size={18} weight="duotone" /> 安全完成账号邀请</span>
          <h1>给管理员账号，<br />设置一个只有你知道的密码。</h1>
          <p>密码只会提交给 Netlify Identity。设置完成后，网站会直接打开倾听员工作台。</p>
          <ul>
            <li><CheckCircle size={21} weight="fill" /> 不要把密码或邮件令牌发送给任何人</li>
            <li><CheckCircle size={21} weight="fill" /> 管理员只能看到来访者的匿名代号</li>
            <li><CheckCircle size={21} weight="fill" /> 建议使用独立且不重复的密码</li>
          </ul>
        </section>
        <section className="auth-card" aria-labelledby="invite-title">
          <div className="auth-card-heading">
            <span className="auth-icon"><LockKey size={26} /></span>
            <div><h2 id="invite-title">接受管理员邀请</h2><p>设置密码后即可登录</p></div>
          </div>
          <form onSubmit={submit}>
            <PasswordField label="设置密码" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
            <PasswordField label="再次输入密码" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" placeholder="再次输入相同密码" />
            {error && <div className="form-message error"><WarningCircle size={18} /> {error}</div>}
            <button className="button button-primary button-block" disabled={busy} type="submit">
              {busy ? "正在启用账号…" : "设置密码并进入工作台"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function AuthCallbackErrorPage({ message, onDismiss }) {
  return (
    <div className="page auth-page">
      <SiteHeader />
      <main className="content-page">
        <section className="auth-card">
          <div className="form-message error"><WarningCircle size={20} /> {message}</div>
          <p>这个身份验证链接可能已经过期或使用过。请返回登录；如果是在找回密码，可以重新发送一封重置邮件。</p>
          <div className="callback-actions">
            <button className="button button-secondary" type="button" onClick={onDismiss}>返回首页</button>
            <Link className="button button-primary" to="/forgot-password" onClick={onDismiss}>重新找回密码</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function ProtectedRoute({ role, children }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="screen-loader"><Cloud size={34} weight="duotone" /> 正在打开信箱…</div>;
  if (!session) return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}${location.hash}` }} replace />;
  if (role && session.role !== role) return <Navigate to={session.role === "admin" ? "/admin" : "/app"} replace />;
  return children;
}

function AppHeader({ title, subtitle, identityName }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="app-header">
      <Brand compact />
      <div className="app-header-title"><strong>{title}</strong><span>{subtitle}</span></div>
      <div className="app-user">
        <span className="role-badge">{session.role === "admin" ? "管理员" : "匿名用户"}</span>
        <strong>{identityName ?? (session.role === "admin" ? session.displayName : session.alias)}</strong>
        <button className="icon-button" type="button" onClick={async () => { await logout(); navigate("/"); }} aria-label="退出登录"><SignOut size={20} /></button>
      </div>
    </header>
  );
}

function UserDashboard() {
  const { session } = useAuth();
  const { conversations, loading, error } = useConversations();
  const navigate = useNavigate();
  const mine = conversations
    .filter((conversation) => !conversation.clientId || conversation.clientId === session.id)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
  const active = mine.find((conversation) => conversation.status !== "closed");
  const history = mine.filter((conversation) => conversation.status === "closed");
  const [topic, setTopic] = useState("最近有点累");
  const [need, setNeed] = useState("希望有人先听我说说");
  const [aiConsent, setAiConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  async function startConversation() {
    setBusy(true);
    setActionError("");
    try {
      const conversation = await createConversation(session, { topic, need, aiConsent });
      navigate(`/chat/${conversation.id}`);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法创建会话，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader title="我的云朵信箱" subtitle="这里不会显示你的注册邮箱" />
      <main className="dashboard-layout">
        <section className="welcome-panel">
          <div>
            <span className="eyebrow"><Heart size={17} weight="fill" /> {getGreeting()}，{session.displayName}</span>
            <h1>今天想从哪里说起？</h1>
            <p>{active ? <>你在本次会话中的匿名代号是 <strong>{active.alias}</strong>。倾听员只会看到这个代号。</> : "创建会话后，系统会为这次倾诉生成一个随机匿名代号。"}</p>
          </div>
          <span className="privacy-seal"><LockKey size={28} weight="duotone" /> 身份已隐藏</span>
        </section>

        {(error || actionError) && <div className="form-message error"><WarningCircle size={18} /> {actionError || error}</div>}

        {loading ? (
          <section className="current-conversation"><Cloud size={32} weight="duotone" /> 正在读取你的信箱…</section>
        ) : active ? (
          <section className="current-conversation">
            <div className="conversation-icon"><ChatsCircle size={34} weight="duotone" /></div>
            <div><span>正在进行的倾诉</span><h2>{active.topic}</h2><p>{statusLabels[active.status]} · {active.messages.length} 条消息</p></div>
            <button className="button button-primary" type="button" onClick={() => navigate(`/chat/${active.id}`)}>继续对话 <ArrowRight size={18} /></button>
          </section>
        ) : (
          <section className="start-panel" aria-labelledby="start-title">
            <div className="section-heading compact"><span className="eyebrow"><ChatCircleDots size={17} /> 新建匿名倾诉</span><h2 id="start-title">先告诉我们，你更想聊什么</h2><p>这些选项只用于帮助倾听员更好地回应，不会形成诊断。</p></div>
            <div className="start-fields">
              <label>最近更接近哪种感受？
                <select value={topic} onChange={(event) => setTopic(event.target.value)}>
                  <option>最近有点累</option><option>焦虑停不下来</option><option>关系让我难过</option><option>说不清，但想找人聊聊</option>
                </select>
              </label>
              <label>你现在更希望得到什么？
                <select value={need} onChange={(event) => setNeed(event.target.value)}>
                  <option>希望有人先听我说说</option><option>想一起理清思绪</option><option>想找一些可用的资源</option>
                </select>
              </label>
            </div>
            <label className="ai-consent-option">
              <input type="checkbox" checked={aiConsent} onChange={(event) => setAiConsent(event.target.checked)} />
              <span><strong>允许 AI 辅助倾听</strong><small>AI会分析本次对话中的情绪线索，为倾听员提供建议；结果仅供人工参考，不做诊断，也不会自动回复。你可以不勾选，正常倾诉不受影响。</small></span>
            </label>
            <button className="button button-primary" type="button" disabled={busy} onClick={startConversation}><ChatCircleDots size={21} weight="fill" /> {busy ? "正在创建…" : "创建匿名会话"}</button>
          </section>
        )}

        <aside className="dashboard-aside">
          <span className="eyebrow"><Leaf size={17} /> 今日温柔提醒</span>
          <blockquote>“你不需要一次想明白所有事，先允许自己停一停。”</blockquote>
          <Link to="/tips">再读一条小贴士 <ArrowRight size={16} /></Link>
        </aside>

        {history.length > 0 && (
          <section className="history-panel" aria-labelledby="history-title">
            <div className="history-heading">
              <div><span className="eyebrow"><BookOpenText size={17} /> 历史倾诉</span><h2 id="history-title">已经结束的会话</h2></div>
              <span>{history.length} 段记录</span>
            </div>
            <div className="history-list">
              {history.map((conversation) => (
                <Link key={conversation.id} to={`/chat/${conversation.id}`}>
                  <span className="list-avatar"><Cloud size={22} weight="duotone" /></span>
                  <span><strong>{conversation.topic}</strong><small>{conversation.alias} · {formatConversationDate(conversation.updatedAt)}</small></span>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function ChatPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const { conversations, loading, error, refresh } = useConversations();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [aiSettingBusy, setAiSettingBusy] = useState(false);
  const messageEndRef = useRef(null);
  const conversation = conversations.find((item) => item.id === id);

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation?.messages.length]);

  if (loading) return <div className="screen-loader"><Cloud size={34} weight="duotone" /> 正在读取对话…</div>;
  if (error && !conversation) {
    return <div className="screen-loader"><WarningCircle size={34} /> {error}<button className="button button-secondary" type="button" onClick={refresh}>重试</button></div>;
  }
  if (!conversation || (session.role === "client" && conversation.clientId && conversation.clientId !== session.id)) {
    return <Navigate to={session.role === "admin" ? "/admin" : "/app"} replace />;
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setActionError("");
    try {
      await sendMessage(conversation.id, session.role, draft, image);
      setDraft("");
      setImage(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "消息发送失败，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    setActionError("");
    try {
      await closeConversation(conversation.id);
      setConfirmingClose(false);
      navigate(session.role === "admin" ? "/admin" : "/app");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法结束会话。");
      setBusy(false);
    }
  }

  async function handleAiAssistanceChange(event) {
    const enabled = event.target.checked;
    setAiSettingBusy(true);
    setActionError("");
    try {
      await setAiAssistance(conversation.id, enabled);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法更改 AI 辅助设置。");
    } finally {
      setAiSettingBusy(false);
    }
  }

  function handleComposerKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && (draft.trim() || image) && !busy) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function selectImage(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    const validationError = validateChatImage(file);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setActionError("");
    setImage(file);
  }

  return (
    <div className="app-shell">
      <AppHeader title={session.role === "admin" ? `正在倾听 ${conversation.alias}` : "匿名倾诉"} subtitle={statusLabels[conversation.status]} identityName={session.role === "client" ? conversation.alias : undefined} />
      <main className="chat-layout">
        <aside className="chat-summary">
          <button className="back-link" type="button" onClick={() => navigate(session.role === "admin" ? "/admin" : "/app")}><House size={18} /> 返回工作台</button>
          <span className="avatar-cloud"><Cloud size={38} weight="duotone" /></span>
          <h2>{conversation.alias}</h2>
          <p>{session.role === "admin" ? "对方的注册邮箱和真实姓名不会显示在这里。" : "这是倾听员在本次对话中看到的唯一身份代号。"}</p>
          <dl><div><dt>倾诉主题</dt><dd>{conversation.topic}</dd></div><div><dt>希望得到</dt><dd>{conversation.need}</dd></div></dl>
          {session.role === "client" && (
            <label className="chat-ai-toggle">
              <input type="checkbox" checked={Boolean(conversation.aiAssistanceEnabled)} disabled={aiSettingBusy} onChange={handleAiAssistanceChange} />
              <span><strong>允许 AI 辅助倾听</strong><small>{conversation.aiAssistanceEnabled ? "已开启；关闭后会停止分析并删除已有辅助结果。" : "未开启；正常聊天不受影响。"}</small></span>
            </label>
          )}
          {conversation.status === "closed" ? (
            <span className="closed-status"><CheckCircle size={18} /> 这段会话已结束</span>
          ) : (
            <button className="quiet-danger" type="button" disabled={busy} onClick={() => setConfirmingClose(true)}><XCircle size={18} /> 结束本次会话</button>
          )}
        </aside>
        <section className="messenger" aria-label="匿名对话消息">
          <div className="message-list">
            {groupMessagesByDate(conversation.messages).map((group) => (
              <div className="message-day-group" key={group.key}>
                <div className="chat-day">{formatConversationDate(group.date)}</div>
                {group.messages.map((message) => (
                  <div className={`message-row message-${message.sender} ${getMessagePerspectiveClass(message.sender, session.role)}`} key={message.id}>
                    <span className="message-sender">{message.sender === "system" ? "信箱提醒" : message.sender === "admin" ? "倾听员" : conversation.alias}</span>
                    <MessageContent message={message} />
                    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                  </div>
                ))}
              </div>
            ))}
            <span ref={messageEndRef} />
          </div>
          {conversation.status === "closed" ? (
            <div className="conversation-closed-note"><CheckCircle size={22} weight="duotone" /><div><strong>这段会话已经结束</strong><span>你仍然可以查看完整记录，需要时可回到工作台创建新的倾诉。</span></div></div>
          ) : (
            <form className="composer" onSubmit={submit}>
              <label htmlFor="message-input">{session.role === "admin" ? "写下温柔回应" : "把想说的话放在这里"}</label>
              <ComposerImagePreview file={image} previewUrl={imagePreview} onClear={() => setImage(null)} />
              <div>
                <textarea id="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={session.role === "admin" ? "先接住感受，再慢慢回应…" : "不需要组织得很完整，慢慢说就好…"} rows="3" />
                <label className="image-picker" aria-label="选择一张图片"><PlusCircle size={22} /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /></label>
                <button className="send-button" type="submit" disabled={busy || (!draft.trim() && !image)} aria-label={busy ? "正在发送消息" : "发送消息"}><PaperPlaneTilt size={22} weight="fill" /></button>
              </div>
              <span><LockKey size={15} /> 图片仅对本次会话双方可见；开启 AI 后，倾诉者发送的图片会用于辅助分析 · Ctrl / ⌘ + Enter 发送</span>
              {actionError && <div className="form-message error" role="alert"><WarningCircle size={18} /> {actionError}</div>}
            </form>
          )}
        </section>
      </main>
      {confirmingClose && (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirmingClose(false)}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="close-dialog-title" aria-describedby="close-dialog-description">
            <span className="dialog-icon"><XCircle size={28} /></span>
            <h2 id="close-dialog-title">要结束这段会话吗？</h2>
            <p id="close-dialog-description">结束后将保留聊天记录，但不能继续发送消息。需要时可以重新创建一段倾诉。</p>
            <div>
              <button className="button button-secondary" type="button" onClick={() => setConfirmingClose(false)} autoFocus>继续聊一会</button>
              <button className="button button-danger" type="button" disabled={busy} onClick={handleClose}>{busy ? "正在结束…" : "确认结束"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const intensityLabels = ["较平稳", "轻微", "较明显", "强烈"];

function AiAssistantPanel({ conversation, onUseSuggestion, onRetry, retrying = false, compact = false }) {
  const analysis = conversation.aiAnalysis;
  const lastClientMessage = conversation.messages.filter((message) => message.sender === "client").at(-1);
  const stale = analysis?.status === "ready" && lastClientMessage && analysis.sourceMessageId !== lastClientMessage.id;

  if (!conversation.aiAssistanceEnabled) {
    return (
      <section className={`ai-assistant-panel ${compact ? "compact" : ""}`}>
        <div className="ai-panel-heading"><span><Sparkle size={18} weight="fill" /> AI 辅助观察</span><i className="ai-state muted">未开启</i></div>
        <p className="ai-empty-copy">倾诉者没有授权本次会话使用 AI 分析。聊天功能保持正常，倾听员仍可按照自己的判断回应。</p>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className={`ai-assistant-panel ${compact ? "compact" : ""}`}>
        <div className="ai-panel-heading"><span><Sparkle size={18} weight="fill" /> AI 辅助观察</span><i className="ai-state muted">等待消息</i></div>
        <p className="ai-empty-copy">倾诉者发送新消息后，这里会出现情绪线索与回应建议。</p>
      </section>
    );
  }

  if (analysis.status === "pending") {
    return (
      <section className={`ai-assistant-panel ${compact ? "compact" : ""}`} aria-live="polite">
        <div className="ai-panel-heading"><span><Sparkle size={18} weight="fill" /> AI 辅助观察</span><i className="ai-state analyzing">分析中</i></div>
        <div className="ai-loading"><span /><span /><span /></div>
        <p className="ai-empty-copy">正在结合最近对话整理情绪线索，不会影响消息收发。</p>
      </section>
    );
  }

  if (analysis.status === "failed") {
    return (
      <section className={`ai-assistant-panel ${compact ? "compact" : ""}`} aria-live="polite">
        <div className="ai-panel-heading"><span><Sparkle size={18} weight="fill" /> AI 辅助观察</span><i className="ai-state failed">暂时失败</i></div>
        <p className="ai-empty-copy">本次分析没有完成，正常聊天不受影响。可以稍后重新尝试。</p>
        <button className="ai-text-button" type="button" disabled={retrying} onClick={onRetry}>{retrying ? "正在重试…" : "重新分析"}</button>
      </section>
    );
  }

  const urgent = analysis.safetyLevel === "urgent";
  const watch = analysis.safetyLevel === "watch";
  return (
    <section className={`ai-assistant-panel ${compact ? "compact" : ""} ${urgent ? "urgent" : watch ? "watch" : ""}`} aria-live="polite">
      <div className="ai-panel-heading">
        <span><Sparkle size={18} weight="fill" /> AI 辅助观察</span>
        <i className={`ai-state ${urgent ? "urgent" : watch ? "watch" : "ready"}`}>{urgent ? "立即复核" : watch ? "建议关注" : stale ? "待更新" : "已更新"}</i>
      </div>
      {stale && <p className="ai-stale-note"><WarningCircle size={16} /> 当前提示对应较早消息，请等待最新分析。</p>}
      <div className="ai-emotion-summary">
        <span>可能的感受</span>
        <strong>{analysis.primaryEmotion || "需要进一步倾听"}</strong>
        <small>{intensityLabels[analysis.intensity] ?? "需要确认"}{analysis.secondaryEmotions?.length ? ` · ${analysis.secondaryEmotions.join("、")}` : ""}</small>
      </div>
      <dl className="ai-insights">
        <div><dt>可能更需要</dt><dd>{analysis.currentNeed}</dd></div>
        <div><dt>观察线索</dt><dd>{analysis.observation}</dd></div>
      </dl>
      {(urgent || watch) && (
        <div className="ai-safety-card">
          <strong><WarningCircle size={18} weight="fill" /> {urgent ? "请立即人工确认安全状况" : "建议尽快人工确认"}</strong>
          {analysis.safetyReasons?.map((reason) => <p key={reason}>{reason}</p>)}
          {urgent && <p>不要独自承担。按校方危机干预流程联系专业人员；可拨打 <a href="tel:12356">12356</a>，存在立即危险时联系 110 / 120。</p>}
        </div>
      )}
      <div className="ai-suggestion">
        <span>建议先这样回应</span>
        <p>{analysis.suggestedOpening}</p>
        <button type="button" onClick={() => onUseSuggestion(analysis.suggestedOpening)}>放入回复框</button>
      </div>
      {!!analysis.followUpQuestions?.length && <div className="ai-question"><span>可以轻轻追问</span><p>{analysis.followUpQuestions[0]}</p></div>}
      {!!analysis.avoidPhrases?.length && <p className="ai-avoid">尽量避免：{analysis.avoidPhrases.join("、")}</p>}
      <footer><ShieldCheck size={15} /> AI 可能误判，仅供倾听员参考，不构成心理诊断。</footer>
    </section>
  );
}

function AdminDashboard() {
  const { conversations, loading, error } = useConversations();
  const [selectedId, setSelectedId] = useState(() => conversations[0]?.id ?? null);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);
  const adminMessageEndRef = useRef(null);
  const filteredConversations = conversations.filter((conversation) => {
    if (filter === "waiting") return conversation.status === "waiting";
    if (filter === "closed") return conversation.status === "closed";
    return true;
  });
  const selected = filteredConversations.find((conversation) => conversation.id === selectedId) ?? filteredConversations[0];
  const waitingCount = conversations.filter((conversation) => conversation.status === "waiting").length;
  const closedCount = conversations.filter((conversation) => conversation.status === "closed").length;

  useEffect(() => {
    if (!image) {
      setImagePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    adminMessageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selected?.id, selected?.messages.length]);

  useEffect(() => setAiPanelOpen(false), [selected?.id]);

  useEffect(() => setImage(null), [selected?.id]);

  async function reply(event) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setActionError("");
    try {
      await sendMessage(selected.id, "admin", draft, image);
      setDraft("");
      setImage(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "回复发送失败，请稍后再试。");
    } finally {
      setBusy(false);
    }
  }

  function handleReplyKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && (draft.trim() || image) && !busy) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function selectReplyImage(event) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    const validationError = validateChatImage(file);
    if (validationError) {
      setActionError(validationError);
      return;
    }
    setActionError("");
    setImage(file);
  }

  async function retrySelectedAnalysis() {
    if (!selected || retryingAnalysis) return;
    setRetryingAnalysis(true);
    setActionError("");
    try {
      await retryAiAnalysis(selected.id);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法重新分析。");
    } finally {
      setRetryingAnalysis(false);
    }
  }

  function useAiSuggestion(suggestion) {
    setDraft((current) => current.trim() ? `${current.trim()}\n\n${suggestion}` : suggestion);
  }

  return (
    <div className="app-shell admin-shell">
      <AppHeader title="倾听员工作台" subtitle="所有来访者仅显示匿名代号" />
      <main className="admin-layout">
        <aside className="conversation-list">
          <div className="list-heading"><div><span className="eyebrow"><UsersThree size={17} /> 会话收件箱</span><h1>等待被听见</h1></div><span className="count-badge">{waitingCount} 待回复</span></div>
          <div className="conversation-tabs" aria-label="筛选会话">
            <button className={filter === "all" ? "active" : ""} type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部 <span>{conversations.length}</span></button>
            <button className={filter === "waiting" ? "active" : ""} type="button" aria-pressed={filter === "waiting"} onClick={() => setFilter("waiting")}>待回复 <span>{waitingCount}</span></button>
            <button className={filter === "closed" ? "active" : ""} type="button" aria-pressed={filter === "closed"} onClick={() => setFilter("closed")}>已结束 <span>{closedCount}</span></button>
          </div>
          <div className="conversation-rows">
            {filteredConversations.map((conversation) => {
              const lastMessage = conversation.messages.at(-1);
              return (
                <button className={conversation.id === selected?.id ? "selected" : ""} type="button" key={conversation.id} onClick={() => setSelectedId(conversation.id)}>
                  <span className="list-avatar"><Cloud size={24} weight="duotone" /></span>
                  <span className="row-copy"><strong>{conversation.alias}</strong><small>{lastMessage?.body || (lastMessage?.attachments?.length ? "[图片]" : "")}</small></span>
                  <span className="row-meta"><time dateTime={conversation.updatedAt}>{formatListTime(conversation.updatedAt)}</time><i className={`status-dot status-${conversation.status}`} /></span>
                </button>
              );
            })}
            {loading && !conversations.length && <div className="empty-state"><Cloud size={34} weight="duotone" /><p>正在读取会话…</p></div>}
            {!loading && !filteredConversations.length && <div className="empty-state"><ChatsCircle size={34} /><p>{filter === "waiting" ? "目前没有待回复会话" : filter === "closed" ? "目前没有已结束会话" : "暂时没有新会话"}</p><small>切换上方筛选可查看其他会话</small></div>}
            {error && <div className="list-error"><WarningCircle size={17} /> {error}</div>}
          </div>
        </aside>
        <section className="admin-conversation">
          {selected ? (
            <>
              <header><div><span className="avatar-cloud small"><Cloud size={28} weight="duotone" /></span><div><h2>{selected.alias}</h2><p>{selected.topic} · {statusLabels[selected.status]}</p></div></div><Link className="button button-secondary compact-button" to={`/chat/${selected.id}`}>打开完整会话</Link></header>
              <button className={`ai-status-bar ${selected.aiAnalysis?.safetyLevel === "urgent" ? "urgent" : selected.aiAnalysis?.safetyLevel === "watch" ? "watch" : ""}`} type="button" onClick={() => setAiPanelOpen((open) => !open)} aria-expanded={aiPanelOpen}>
                <span><Sparkle size={18} weight="fill" /><strong>AI 辅助观察</strong></span>
                <span>{!selected.aiAssistanceEnabled ? "倾诉者未开启" : selected.aiAnalysis?.status === "pending" ? "正在分析最新消息…" : selected.aiAnalysis?.status === "failed" ? "分析暂时失败" : selected.aiAnalysis?.status === "ready" ? `可能感到：${selected.aiAnalysis.primaryEmotion} · ${selected.aiAnalysis.currentNeed}` : "等待倾诉消息"}</span>
                <small>{aiPanelOpen ? "收起" : "查看建议"}</small>
              </button>
              {aiPanelOpen && <div className="ai-inline-panel"><AiAssistantPanel conversation={selected} onUseSuggestion={useAiSuggestion} onRetry={retrySelectedAnalysis} retrying={retryingAnalysis} compact /></div>}
              <div className="admin-messages">
                {groupMessagesByDate(selected.messages).map((group) => (
                  <div className="message-day-group" key={group.key}>
                    <div className="chat-day">{formatConversationDate(group.date)}</div>
                    {group.messages.map((message) => (
                      <div className={`message-row message-${message.sender} ${getMessagePerspectiveClass(message.sender, "admin")}`} key={message.id}>
                        <span className="message-sender">{message.sender === "system" ? "信箱提醒" : message.sender === "admin" ? "我" : selected.alias}</span>
                        <MessageContent message={message} />
                        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      </div>
                    ))}
                  </div>
                ))}
                <span ref={adminMessageEndRef} />
              </div>
              {selected.status === "closed" ? (
                <div className="conversation-closed-note compact"><CheckCircle size={22} weight="duotone" /><div><strong>这段会话已结束</strong><span>记录保留为只读，不能继续回复。</span></div></div>
              ) : (
                <form className="admin-composer" onSubmit={reply}>
                  <ComposerImagePreview file={image} previewUrl={imagePreview} onClear={() => setImage(null)} />
                  <textarea aria-label="回复内容" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleReplyKeyDown} rows="3" placeholder="先接住情绪，再慢慢回应…" />
                  {actionError && <div className="form-message error"><WarningCircle size={18} /> {actionError}</div>}
                  <div><span><ShieldCheck size={17} /> 不诊断、不评判 · 图片仅会话双方可见</span><span className="admin-composer-actions"><label className="button button-secondary compact-button image-action"><PlusCircle size={17} /> 添加图片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectReplyImage} /></label><button className="button button-primary" disabled={busy || (!draft.trim() && !image)} type="submit">{busy ? "发送中…" : "发送回复"} <PaperPlaneTilt size={18} weight="fill" /></button></span></div>
                </form>
              )}
            </>
          ) : <div className="empty-state large">{error ? <><WarningCircle size={48} /><h2>{error}</h2></> : <><ChatsCircle size={48} /><h2>选择一段会话开始倾听</h2></>}</div>}
        </section>
        {selected && (
          <aside className="admin-details">
            <span className="eyebrow"><LockKey size={17} /> 匿名资料</span>
            <h3>{selected.alias}</h3>
            <p>系统不会向倾听员展示邮箱、真实姓名或登录方式。</p>
            <dl><div><dt>当前状态</dt><dd>{statusLabels[selected.status]}</dd></div><div><dt>倾诉主题</dt><dd>{selected.topic}</dd></div><div><dt>希望得到</dt><dd>{selected.need}</dd></div><div><dt>消息数量</dt><dd>{selected.messages.length} 条</dd></div></dl>
            <AiAssistantPanel conversation={selected} onUseSuggestion={useAiSuggestion} onRetry={retrySelectedAnalysis} retrying={retryingAnalysis} />
            <div className="admin-reminder"><Heart size={21} weight="fill" /><p>先回应感受，再询问事实。允许沉默，也允许用户暂停。</p></div>
          </aside>
        )}
      </main>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <Brand compact />
      <p>一个用于匿名表达与温柔倾听的空间 · 对话内容由登录与权限规则保护</p>
      <div><Link to="/tips">心理小贴士</Link><Link to="/about#privacy">隐私与安全</Link><a href="https://github.com/makesisisi/cream-cloud-mailbox/issues" target="_blank" rel="noreferrer">问题反馈</a></div>
    </footer>
  );
}

function NotFoundPage() {
  return (
    <div className="page">
      <SiteHeader />
      <main className="not-found-page">
        <Cloud size={56} weight="duotone" />
        <span className="eyebrow">这朵云暂时飘走了</span>
        <h1>没有找到这个页面</h1>
        <p>链接可能已经失效，也可能输入有误。你可以回到首页重新开始。</p>
        <Link className="button button-primary" to="/">返回首页</Link>
      </main>
      <Footer />
    </div>
  );
}

function HashScroll() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    window.requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" }));
  }, [hash, pathname]);
  return null;
}

function AppRoutes() {
  const { authCallback, authError, clearAuthError, loading } = useAuth();
  if (loading) return <div className="screen-loader"><Cloud size={34} weight="duotone" /> 正在确认邀请…</div>;
  if (authCallback?.type === "invite" && authCallback.token) {
    return <InviteAcceptPage token={authCallback.token} />;
  }
  if (authCallback?.type === "recovery") return <PasswordResetPage />;
  if (authError) return <AuthCallbackErrorPage message={authError} onDismiss={clearAuthError} />;

  return (
    <>
      <HashScroll />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tips" element={<TipsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<PasswordRecoveryRequestPage />} />
        <Route path="/app" element={<ProtectedRoute role="client"><UserDashboard /></ProtectedRoute>} />
        <Route path="/chat/:id" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
