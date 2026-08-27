import { useState } from "react";
import {
  ArrowRight,
  BookOpenText,
  ChatCircleDots,
  ChatsCircle,
  CheckCircle,
  Cloud,
  Heart,
  House,
  Leaf,
  LockKey,
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
  useParams,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import { demoAccounts } from "./auth/authService.js";
import {
  closeConversation,
  createConversation,
  sendMessage,
  useConversations,
} from "./data/chatStore.js";

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
        <a href="/#listening">倾听方式</a>
        <a href="/#about">关于我们</a>
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

        <section className="tips-section" id="about" aria-labelledby="tips-title">
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

function AuthPage({ mode }) {
  const isRegister = mode === "register";
  const { login, register, authMode } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
        if (result.needsConfirmation) setMessage("注册成功，请打开邮箱完成确认后再登录。");
        else navigate("/app");
      } else {
        const session = await login(form.email, form.password);
        navigate(session.role === "admin" ? "/admin" : "/app");
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
            <div><h2 id="auth-title">{isRegister ? "注册账号" : "登录账号"}</h2><p>{isRegister ? "只需要一个邮箱和密码" : "继续之前的匿名会话"}</p></div>
          </div>
          <form onSubmit={submit}>
            {isRegister && (
              <label>称呼（仅用于登录后的问候）
                <input required value={form.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="例如：小云" />
              </label>
            )}
            <label>邮箱
              <input type="email" required value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="name@example.com" autoComplete="email" />
            </label>
            <label>密码
              <input type="password" minLength={8} required value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="至少 8 位" autoComplete={isRegister ? "new-password" : "current-password"} />
            </label>
            {error && <div className="form-message error"><WarningCircle size={18} /> {error}</div>}
            {message && <div className="form-message success"><CheckCircle size={18} /> {message}</div>}
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

function ProtectedRoute({ role, children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="screen-loader"><Cloud size={34} weight="duotone" /> 正在打开信箱…</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) return <Navigate to={session.role === "admin" ? "/admin" : "/app"} replace />;
  return children;
}

function AppHeader({ title, subtitle }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="app-header">
      <Brand compact />
      <div className="app-header-title"><strong>{title}</strong><span>{subtitle}</span></div>
      <div className="app-user">
        <span className="role-badge">{session.role === "admin" ? "管理员" : "匿名用户"}</span>
        <strong>{session.role === "admin" ? session.displayName : session.alias}</strong>
        <button className="icon-button" type="button" onClick={async () => { await logout(); navigate("/"); }} aria-label="退出登录"><SignOut size={20} /></button>
      </div>
    </header>
  );
}

function UserDashboard() {
  const { session } = useAuth();
  const conversations = useConversations();
  const navigate = useNavigate();
  const mine = conversations.filter((conversation) => conversation.clientId === session.id);
  const active = mine.find((conversation) => conversation.status !== "closed");
  const [topic, setTopic] = useState("最近有点累");
  const [need, setNeed] = useState("希望有人先听我说说");

  function startConversation() {
    const conversation = createConversation(session, { topic, need });
    navigate(`/chat/${conversation.id}`);
  }

  return (
    <div className="app-shell">
      <AppHeader title="我的云朵信箱" subtitle="这里不会显示你的注册邮箱" />
      <main className="dashboard-layout">
        <section className="welcome-panel">
          <div>
            <span className="eyebrow"><Heart size={17} weight="fill" /> 晚上好，{session.displayName}</span>
            <h1>今天想从哪里说起？</h1>
            <p>你在本次会话中的匿名代号是 <strong>{session.alias}</strong>。倾听员只会看到这个代号。</p>
          </div>
          <span className="privacy-seal"><LockKey size={28} weight="duotone" /> 身份已隐藏</span>
        </section>

        {active ? (
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
            <button className="button button-primary" type="button" onClick={startConversation}><ChatCircleDots size={21} weight="fill" /> 创建匿名会话</button>
          </section>
        )}

        <aside className="dashboard-aside">
          <span className="eyebrow"><Leaf size={17} /> 今日温柔提醒</span>
          <blockquote>“你不需要一次想明白所有事，先允许自己停一停。”</blockquote>
          <Link to="/tips">再读一条小贴士 <ArrowRight size={16} /></Link>
        </aside>
      </main>
    </div>
  );
}

function ChatPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const conversations = useConversations();
  const navigate = useNavigate();
  const [draft, setDraft] = useState("");
  const conversation = conversations.find((item) => item.id === id);

  if (!conversation || (session.role === "client" && conversation.clientId !== session.id)) {
    return <Navigate to={session.role === "admin" ? "/admin" : "/app"} replace />;
  }

  function submit(event) {
    event.preventDefault();
    sendMessage(conversation.id, session.role, draft);
    setDraft("");
  }

  return (
    <div className="app-shell">
      <AppHeader title={session.role === "admin" ? `正在倾听 ${conversation.alias}` : "匿名倾诉"} subtitle={statusLabels[conversation.status]} />
      <main className="chat-layout">
        <aside className="chat-summary">
          <button className="back-link" type="button" onClick={() => navigate(session.role === "admin" ? "/admin" : "/app")}><House size={18} /> 返回工作台</button>
          <span className="avatar-cloud"><Cloud size={38} weight="duotone" /></span>
          <h2>{conversation.alias}</h2>
          <p>{session.role === "admin" ? "对方的注册邮箱和真实姓名不会显示在这里。" : "这是倾听员在本次对话中看到的唯一身份代号。"}</p>
          <dl><div><dt>倾诉主题</dt><dd>{conversation.topic}</dd></div><div><dt>希望得到</dt><dd>{conversation.need}</dd></div></dl>
          <button className="quiet-danger" type="button" onClick={() => { closeConversation(conversation.id); navigate(session.role === "admin" ? "/admin" : "/app"); }}><XCircle size={18} /> 结束本次会话</button>
        </aside>
        <section className="messenger" aria-label="匿名对话消息">
          <div className="message-list">
            <div className="chat-day">今天</div>
            {conversation.messages.map((message) => (
              <div className={`message-row message-${message.sender}`} key={message.id}>
                <span className="message-sender">{message.sender === "system" ? "信箱提醒" : message.sender === "admin" ? "倾听员" : conversation.alias}</span>
                <div className="message-bubble">{message.body}</div>
                <time>{formatTime(message.createdAt)}</time>
              </div>
            ))}
          </div>
          <form className="composer" onSubmit={submit}>
            <label htmlFor="message-input">把想说的话放在这里</label>
            <div>
              <textarea id="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="不需要组织得很完整，慢慢说就好…" rows="3" disabled={conversation.status === "closed"} />
              <button className="send-button" type="submit" disabled={!draft.trim() || conversation.status === "closed"} aria-label="发送消息"><PaperPlaneTilt size={22} weight="fill" /></button>
            </div>
            <span><LockKey size={15} /> 请避免发送姓名、地址、身份证号等可识别信息</span>
          </form>
        </section>
      </main>
    </div>
  );
}

function AdminDashboard() {
  const conversations = useConversations();
  const [selectedId, setSelectedId] = useState(() => conversations[0]?.id ?? null);
  const [draft, setDraft] = useState("");
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0];
  const waitingCount = conversations.filter((conversation) => conversation.status === "waiting").length;

  function reply(event) {
    event.preventDefault();
    if (!selected) return;
    sendMessage(selected.id, "admin", draft);
    setDraft("");
  }

  return (
    <div className="app-shell admin-shell">
      <AppHeader title="倾听员工作台" subtitle="所有来访者仅显示匿名代号" />
      <main className="admin-layout">
        <aside className="conversation-list">
          <div className="list-heading"><div><span className="eyebrow"><UsersThree size={17} /> 会话收件箱</span><h1>等待被听见</h1></div><span className="count-badge">{waitingCount} 待回复</span></div>
          <div className="conversation-tabs"><button className="active" type="button">全部</button><button type="button">待回复</button><button type="button">已结束</button></div>
          <div className="conversation-rows">
            {conversations.map((conversation) => {
              const lastMessage = conversation.messages.at(-1);
              return (
                <button className={conversation.id === selected?.id ? "selected" : ""} type="button" key={conversation.id} onClick={() => setSelectedId(conversation.id)}>
                  <span className="list-avatar"><Cloud size={24} weight="duotone" /></span>
                  <span className="row-copy"><strong>{conversation.alias}</strong><small>{lastMessage?.body}</small></span>
                  <span className="row-meta"><time>{formatTime(conversation.updatedAt)}</time><i className={`status-dot status-${conversation.status}`} /></span>
                </button>
              );
            })}
            {!conversations.length && <div className="empty-state"><ChatsCircle size={34} /><p>暂时没有新会话</p></div>}
          </div>
        </aside>
        <section className="admin-conversation">
          {selected ? (
            <>
              <header><div><span className="avatar-cloud small"><Cloud size={28} weight="duotone" /></span><div><h2>{selected.alias}</h2><p>{selected.topic} · {statusLabels[selected.status]}</p></div></div><Link className="button button-secondary compact-button" to={`/chat/${selected.id}`}>打开完整会话</Link></header>
              <div className="admin-messages">
                {selected.messages.map((message) => (
                  <div className={`message-row message-${message.sender}`} key={message.id}>
                    <span className="message-sender">{message.sender === "system" ? "信箱提醒" : message.sender === "admin" ? "我" : selected.alias}</span>
                    <div className="message-bubble">{message.body}</div>
                    <time>{formatTime(message.createdAt)}</time>
                  </div>
                ))}
              </div>
              <form className="admin-composer" onSubmit={reply}>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows="3" placeholder="先接住情绪，再慢慢回应…" disabled={selected.status === "closed"} />
                <div><span><ShieldCheck size={17} /> 回复前确认：不诊断、不评判、不承诺即时救援</span><button className="button button-primary" disabled={!draft.trim() || selected.status === "closed"} type="submit">发送回复 <PaperPlaneTilt size={18} weight="fill" /></button></div>
              </form>
            </>
          ) : <div className="empty-state large"><ChatsCircle size={48} /><h2>选择一段会话开始倾听</h2></div>}
        </section>
        {selected && (
          <aside className="admin-details">
            <span className="eyebrow"><LockKey size={17} /> 匿名资料</span>
            <h3>{selected.alias}</h3>
            <p>系统不会向倾听员展示邮箱、真实姓名或登录方式。</p>
            <dl><div><dt>当前状态</dt><dd>{statusLabels[selected.status]}</dd></div><div><dt>倾诉主题</dt><dd>{selected.topic}</dd></div><div><dt>希望得到</dt><dd>{selected.need}</dd></div><div><dt>消息数量</dt><dd>{selected.messages.length} 条</dd></div></dl>
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
      <p>一个用于匿名表达与温柔倾听的空间 · 当前为本地功能原型</p>
      <div><Link to="/tips">心理小贴士</Link><a href="mailto:hello@example.com">联系我们</a></div>
    </footer>
  );
}

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/tips" element={<TipsPage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/app" element={<ProtectedRoute role="client"><UserDashboard /></ProtectedRoute>} />
      <Route path="/chat/:id" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
