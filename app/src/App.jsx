import { useEffect, useRef, useState } from "react";
import {
  ArrowBendUpLeft,
  ArrowCounterClockwise,
  ArrowRight,
  BookOpenText,
  ChatCircleDots,
  ChatsCircle,
  CheckCircle,
  Cloud,
  DotsThree,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  Heart,
  House,
  Leaf,
  LockKey,
  MagnifyingGlass,
  List,
  PaperPlaneTilt,
  PlusCircle,
  PushPin,
  ShieldCheck,
  SignIn,
  SignOut,
  Sparkle,
  SpinnerGap,
  Trash,
  UserCircle,
  UsersThree,
  Tag,
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
import { useConversationDraft, useConversationScroll } from "./utils/conversationExperience.js";
import {
  closeConversation,
  createConversation,
  deleteConversation,
  recallMessage,
  retryAiAnalysis,
  sendMessage,
  setAiAssistance,
  updateConversationAdminState,
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
import {
  canRecallMessage,
  createReplySnapshot,
  getReplySummary,
} from "./utils/messageExperience.js";
import {
  conversationTagOptions,
  getConversationRiskRank,
  getConversationUnreadCount,
  getLastReplyMeta,
  matchesConversationSearch,
  sortAdminConversations,
} from "./utils/inboxExperience.js";
import {
  canCompleteCrisisHandoff,
  crisisStatusLabels,
  crisisSteps,
  getCrisisCompletion,
} from "./utils/crisisExperience.js";
import { CLOSED_CONVERSATION_RETENTION_DAYS } from "../shared/privacy-policy.mjs";

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
const ACCESSIBILITY_PREFERENCES_KEY = "cloudmail.accessibility.preferences";

function readAccessibilityPreferences() {
  try {
    return {
      largeText: false,
      highContrast: false,
      reduceMotion: false,
      ...JSON.parse(window.localStorage.getItem(ACCESSIBILITY_PREFERENCES_KEY) ?? "{}"),
    };
  } catch {
    return { largeText: false, highContrast: false, reduceMotion: false };
  }
}

function AccessibilityMenu() {
  const [preferences, setPreferences] = useState(readAccessibilityPreferences);
  const enabledCount = Object.values(preferences).filter(Boolean).length;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.largeText = String(preferences.largeText);
    root.dataset.highContrast = String(preferences.highContrast);
    root.dataset.reduceMotion = String(preferences.reduceMotion);
    window.localStorage.setItem(ACCESSIBILITY_PREFERENCES_KEY, JSON.stringify(preferences));
  }, [preferences]);

  function toggle(key) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <details className="accessibility-menu">
      <summary aria-label={`阅读辅助设置${enabledCount ? `，已开启 ${enabledCount} 项` : ""}`}>
        <Eye size={19} aria-hidden="true" />
        <span>阅读辅助</span>
        {enabledCount > 0 && <i aria-hidden="true">{enabledCount}</i>}
      </summary>
      <div className="accessibility-popover" role="group" aria-label="阅读辅助选项">
        <header><div><strong>阅读辅助</strong><small>设置会保存在这台设备上</small></div><Eye size={22} aria-hidden="true" /></header>
        <button type="button" aria-label={`大号文字，${preferences.largeText ? "已开启" : "未开启"}`} aria-pressed={preferences.largeText} onClick={() => toggle("largeText")}>
          <span><strong>大号文字</strong><small>放大正文、提示与状态文字</small></span><i aria-hidden="true" />
        </button>
        <button type="button" aria-label={`增强对比，${preferences.highContrast ? "已开启" : "未开启"}`} aria-pressed={preferences.highContrast} onClick={() => toggle("highContrast")}>
          <span><strong>增强对比</strong><small>加深文字与边界，减少透明干扰</small></span><i aria-hidden="true" />
        </button>
        <button type="button" aria-label={`减少动效，${preferences.reduceMotion ? "已开启" : "未开启"}`} aria-pressed={preferences.reduceMotion} onClick={() => toggle("reduceMotion")}>
          <span><strong>减少动效</strong><small>暂停漂浮、入场与视差动画</small></span><i aria-hidden="true" />
        </button>
        <button className="accessibility-reset" type="button" disabled={!enabledCount} onClick={() => setPreferences({ largeText: false, highContrast: false, reduceMotion: false })}>恢复默认</button>
        <p>如果设备已开启“减少动态效果”，网站也会自动遵循。</p>
      </div>
    </details>
  );
}

function TipCardIcon({ color }) {
  const Icon = color === "sage" ? Leaf : color === "sand" ? Cloud : Heart;
  return <Icon size={23} weight="duotone" aria-hidden="true" />;
}

function validateChatImage(file) {
  if (!file) return "";
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return "只支持 JPG、PNG 或 WebP 图片。";
  if (file.size > MAX_CHAT_IMAGE_SIZE) return "图片不能超过 4 MB。";
  return "";
}

function MessageContent({ message, alias, viewerRole, onReply, onRecall, recalling = false }) {
  const canReply = message.sender !== "system" && !message.recalledAt;
  const canRecall = canRecallMessage(message, viewerRole);
  const replyAuthor = message.replyTo?.sender === viewerRole ? "我" : message.replyTo?.sender === "admin" ? "倾听员" : alias;
  return (
    <div className="message-content-wrap">
      <div className={`message-bubble ${message.attachments?.length ? "has-image" : ""} ${message.recalledAt ? "is-recalled" : ""}`}>
        {message.replyTo && !message.recalledAt && (
          <div className="message-reply-quote">
            <strong>{replyAuthor}</strong>
            <span>{getReplySummary(message.replyTo)}</span>
          </div>
        )}
        {message.recalledAt ? (
          <p className="message-recalled-copy">{message.sender === viewerRole ? "你撤回了一条消息" : "对方撤回了一条消息"}</p>
        ) : (
          <>
            {message.attachments?.map((attachment) => (
              <a className="message-image-link" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.id} aria-label="查看对话图片原图">
                <img src={attachment.url} alt="对话中发送的图片" loading="lazy" decoding="async" />
              </a>
            ))}
            {message.body && <p className="message-body">{message.body}</p>}
          </>
        )}
      </div>
      {(canReply || canRecall) && (
        <details className="message-actions">
          <summary aria-label="打开消息操作"><DotsThree size={20} weight="bold" /></summary>
          <div>
            {canReply && <button type="button" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); onReply?.(message); }}><ArrowBendUpLeft size={16} /> 引用回复</button>}
            {canRecall && <button type="button" disabled={recalling} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); onRecall?.(message); }}><ArrowCounterClockwise size={16} /> {recalling ? "撤回中…" : "撤回"}</button>}
          </div>
        </details>
      )}
    </div>
  );
}

function ReplyComposerPreview({ message, alias, viewerRole, onClear }) {
  if (!message) return null;
  const author = message.sender === viewerRole ? "我" : message.sender === "admin" ? "倾听员" : alias;
  return (
    <div className="composer-reply-preview">
      <ArrowBendUpLeft size={18} />
      <div><strong>回复 {author}</strong><span>{getReplySummary(createReplySnapshot(message))}</span></div>
      <button type="button" onClick={onClear} aria-label="取消引用"><XCircle size={20} /></button>
    </div>
  );
}

function SendProgress({ text }) {
  if (!text) return null;
  return <div className="send-progress" role="status"><SpinnerGap size={17} className="spin" /><div><span>{text}</span><i /></div></div>;
}

function SendFailureNotice({ message, onRetry, disabled }) {
  if (!message) return null;
  return (
    <div className="send-failure" role="alert">
      <WarningCircle size={19} />
      <span><strong>消息还没有发出去</strong><small>{message}</small></span>
      <button type="button" disabled={disabled} onClick={onRetry}><ArrowCounterClockwise size={16} /> 重试</button>
    </div>
  );
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
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
        <AccessibilityMenu />
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

function HomeAtmosphere() {
  const atmosphereRef = useRef(null);

  useEffect(() => {
    const atmosphere = atmosphereRef.current;
    const page = atmosphere?.closest(".page-home");
    if (!atmosphere || !page || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const paint = () => {
      frame = 0;
      const scrollOffset = Math.max(-82, window.scrollY * -0.08);
      page.style.setProperty("--scene-x", `${pointerX}px`);
      page.style.setProperty("--scene-y", `${pointerY + scrollOffset}px`);
      page.style.setProperty("--subject-x", `${pointerX * -0.42}px`);
      page.style.setProperty("--subject-y", `${pointerY * -0.5}px`);
    };

    const requestPaint = () => {
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const handlePointerMove = (event) => {
      pointerX = ((event.clientX / window.innerWidth) - 0.5) * 42;
      pointerY = ((event.clientY / window.innerHeight) - 0.5) * 24;
      requestPaint();
    };

    const handlePointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
      requestPaint();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("scroll", requestPaint, { passive: true });
    requestPaint();

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("scroll", requestPaint);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="home-atmosphere" aria-hidden="true">
      <div className="home-atmosphere-field" ref={atmosphereRef}>
        <img
          className="portal-world-layer"
          src="/assets/cloud-portal-world.webp"
          alt=""
          fetchPriority="high"
          decoding="async"
        />
        <img
          className="portal-haze-layer"
          src="/assets/cloud-glow-atmosphere.webp"
          alt=""
          decoding="async"
        />
        <EnvelopeSimple className="portal-letter portal-letter-one" size={52} weight="duotone" />
        <EnvelopeSimple className="portal-letter portal-letter-two" size={34} weight="duotone" />
        <EnvelopeSimple className="portal-letter portal-letter-three" size={28} weight="duotone" />
        <Sparkle className="portal-mote portal-mote-one" size={26} weight="fill" />
        <Sparkle className="portal-mote portal-mote-two" size={17} weight="fill" />
        <Sparkle className="portal-mote portal-mote-three" size={21} weight="fill" />
      </div>
    </div>
  );
}

function HomePage() {
  const { session } = useAuth();
  const startPath = session ? (session.role === "admin" ? "/admin" : "/app") : "/register";

  return (
    <div className="page page-home">
      <HomeAtmosphere />
      <SiteHeader />
      <main id="main-content" tabIndex="-1">
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
            <span className="hero-art-glass-note"><Sparkle size={16} weight="fill" /> 总有一个地方，可以放心说话</span>
            <img src="/assets/cloud-mailbox-hero-v2.webp" alt="小熊把一封信放进云朵形状的信箱" />
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
                <div className="tip-card-top"><span>{tip.category}</span><TipCardIcon color={tip.color} /></div>
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
      <main id="main-content" tabIndex="-1" className="content-page">
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
              <div className="tip-card-top"><span>{tip.category}</span><TipCardIcon color={tip.color} /></div><h2>{tip.title}</h2><p>{tip.body}</p>
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
      <main id="main-content" tabIndex="-1" className="content-page about-page">
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
            <li><strong>随时暂停</strong><span>你可以晚一点回复；会话结束后保留 {CLOSED_CONVERSATION_RETENTION_DAYS} 天，也可以随时永久删除。</span></li>
          </ol>
        </section>

        <section className="privacy-section" id="privacy" aria-labelledby="privacy-title">
          <span className="eyebrow"><LockKey size={18} /> 隐私与安全</span>
          <h2 id="privacy-title">我们如何保护这段对话</h2>
          <div className="privacy-grid">
            <article><ShieldCheck size={28} weight="duotone" /><h3>权限隔离</h3><p>普通用户只能读取自己的会话，管理员只能通过受保护的工作台回复。</p></article>
            <article><UserCircle size={28} weight="duotone" /><h3>最少展示</h3><p>对话界面不展示邮箱、真实姓名或登录方式；也请不要主动发送可识别信息。</p></article>
            <article><Sparkle size={28} weight="duotone" /><h3>AI 辅助可选</h3><p>只有主动授权后，AI 才会读取主题、期待、最近对话与最新倾诉附图。撤回授权会删除分析结果，不影响正常聊天。</p></article>
            <article><Trash size={28} weight="duotone" /><h3>删除权在你手里</h3><p>倾诉者可以永久删除自己的消息、图片、AI 结果及附属记录；管理员不能代为执行。</p></article>
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
      <main id="main-content" tabIndex="-1" className="auth-layout">
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
      <main id="main-content" tabIndex="-1" className="auth-layout auth-layout-compact">
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
      <main id="main-content" tabIndex="-1" className="auth-layout auth-layout-compact">
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
      <main id="main-content" tabIndex="-1" className="auth-layout">
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
      <main id="main-content" tabIndex="-1" className="content-page">
        <section className="auth-card">
          <h1>身份验证链接暂时无法使用</h1>
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
      <div className="app-header-title"><h1>{title}</h1><span>{subtitle}</span></div>
      <div className="app-user">
        <span className="role-badge">{session.role === "admin" ? "管理员" : "匿名用户"}</span>
        <strong>{identityName ?? (session.role === "admin" ? session.displayName : session.alias)}</strong>
        <AccessibilityMenu />
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
      <main id="main-content" tabIndex="-1" className="dashboard-layout">
        <section className="welcome-panel">
          <div>
            <span className="eyebrow"><Heart size={17} weight="fill" /> {getGreeting()}，{session.displayName}</span>
            <h2>今天想从哪里说起？</h2>
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
  const [draft, setDraft] = useConversationDraft(session.id, session.role, id);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [sendProgress, setSendProgress] = useState("");
  const [failedSend, setFailedSend] = useState(null);
  const [recallingId, setRecallingId] = useState(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [aiSettingBusy, setAiSettingBusy] = useState(false);
  const messageEndRef = useRef(null);
  const conversation = conversations.find((item) => item.id === id);
  const scrolling = useConversationScroll(id, conversation?.messages.length);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);
  const [crisisBusy, setCrisisBusy] = useState(false);

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
    setImage(null);
    setActionError("");
    setReplyingTo(null);
    setFailedSend(null);
    setSendProgress("");
    setConfirmingDelete(false);
    setDeletePhrase("");
    setDeleteError("");
  }, [id]);

  if (loading) return <div className="screen-loader"><Cloud size={34} weight="duotone" /> 正在读取对话…</div>;
  if (error && !conversation) {
    return <div className="screen-loader"><WarningCircle size={34} /> {error}<button className="button button-secondary" type="button" onClick={refresh}>重试</button></div>;
  }
  if (!conversation || (session.role === "client" && conversation.clientId && conversation.clientId !== session.id)) {
    return <Navigate to={session.role === "admin" ? "/admin" : "/app"} replace />;
  }

  async function sendPayload(payload) {
    if (busy || (!payload.body.trim() && !payload.image)) return;
    setBusy(true);
    setActionError("");
    setFailedSend(null);
    try {
      await sendMessage(conversation.id, session.role, payload.body, payload.image, {
        replyToId: payload.replyTo?.id,
        clientMessageId: payload.clientMessageId,
        onProgress: setSendProgress,
      });
      if (draft === payload.body) setDraft("");
      if (image === payload.image) setImage(null);
      if (replyingTo?.id === payload.replyTo?.id) setReplyingTo(null);
      scrolling.jump();
    } catch (reason) {
      setFailedSend({ ...payload, error: reason instanceof Error ? reason.message : "消息发送失败，请稍后再试。" });
    } finally {
      setSendProgress("");
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await sendPayload({
      body: draft,
      image,
      replyTo: replyingTo,
      clientMessageId: crypto.randomUUID(),
    });
  }

  function beginReply(message) {
    setReplyingTo(message);
    window.requestAnimationFrame(() => document.getElementById("message-input")?.focus());
  }

  async function handleRecallMessage(message) {
    if (recallingId) return;
    setRecallingId(message.id);
    setActionError("");
    try {
      await recallMessage(conversation.id, message.id, session.role);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法撤回这条消息。");
    } finally {
      setRecallingId(null);
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

  async function handleDeleteConversation() {
    if (deletePhrase !== "删除" || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteConversation(conversation.id, session);
      setConfirmingDelete(false);
      navigate("/app", { replace: true });
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "暂时无法删除这段会话，请稍后再试。");
      setDeleting(false);
    }
  }

  async function handleCrisisUpdate(patch) {
    if (session.role !== "admin" || crisisBusy) return;
    setCrisisBusy(true);
    setActionError("");
    try {
      await updateConversationAdminState(conversation.id, patch);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法更新危机处理记录。");
    } finally {
      setCrisisBusy(false);
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
      <main id="main-content" tabIndex="-1" className={`chat-layout ${session.role === "admin" ? "admin-full-chat" : ""}`}>
        <aside className="chat-summary">
          <button className="back-link" type="button" onClick={() => navigate(session.role === "admin" ? "/admin" : "/app")}><House size={18} /> 返回工作台</button>
          <span className="avatar-cloud"><Cloud size={38} weight="duotone" /></span>
          <h2>{conversation.alias}</h2>
          <p>{session.role === "admin" ? "对方的注册邮箱和真实姓名不会显示在这里。" : "这是倾听员在本次对话中看到的唯一身份代号。"}</p>
          <dl><div><dt>倾诉主题</dt><dd>{conversation.topic}</dd></div><div><dt>希望得到</dt><dd>{conversation.need}</dd></div></dl>
          {session.role === "client" && (
            <section className={`privacy-control-card ${conversation.aiAssistanceEnabled ? "ai-enabled" : ""}`} aria-labelledby="privacy-control-title">
              <header>
                <span><ShieldCheck size={20} weight="duotone" /><span><strong id="privacy-control-title">本次会话隐私</strong><small>授权与数据都由你决定</small></span></span>
                <i role="status" aria-live="polite">{conversation.aiAssistanceEnabled ? "AI 已授权" : "AI 未授权"}</i>
              </header>
              <label className="chat-ai-toggle">
                <input type="checkbox" checked={Boolean(conversation.aiAssistanceEnabled)} disabled={aiSettingBusy} onChange={handleAiAssistanceChange} />
                <span><strong>允许 AI 辅助倾听</strong><small>{conversation.aiAssistanceEnabled ? "关闭后会停止分析，并立即删除已有 AI 结果。" : "不开启也能正常聊天，不影响倾听员回应。"}</small></span>
              </label>
              <ul className="privacy-facts">
                <li><Eye size={16} /><span><strong>分析什么</strong><small>主题、期待、最近 10 条双方对话；仅最新一条倾诉附图会被读取。</small></span></li>
                <li><LockKey size={16} /><span><strong>谁能看到</strong><small>AI 结果只给倾听员作参考，不会自动发送，也不会替代人工判断。</small></span></li>
                <li><CheckCircle size={16} /><span><strong>保留多久</strong><small>结束后保留 {CLOSED_CONVERSATION_RETENTION_DAYS} 天，到期自动清理；你也可以随时删除。</small></span></li>
              </ul>
              <button className="privacy-delete-button" type="button" onClick={() => { setDeletePhrase(""); setDeleteError(""); setConfirmingDelete(true); }}>
                <Trash size={16} /> 永久删除整段会话
              </button>
            </section>
          )}
          {conversation.status === "closed" ? (
            <span className="closed-status"><CheckCircle size={18} /> 这段会话已结束</span>
          ) : (
            <button className="quiet-danger" type="button" disabled={busy} onClick={() => setConfirmingClose(true)}><XCircle size={18} /> 结束本次会话</button>
          )}
        </aside>
        <section className="messenger" aria-label="匿名对话消息">
          <div className="message-list" ref={scrolling.ref} onScroll={scrolling.onScroll} role="log" aria-live="polite" aria-relevant="additions text" aria-label="匿名对话消息记录" tabIndex="0">
            {groupMessagesByDate(conversation.messages).map((group) => (
              <section className="message-day-group" key={group.key} aria-label={formatConversationDate(group.date)}>
                <h3 className="chat-day">{formatConversationDate(group.date)}</h3>
                {group.messages.map((message) => (
                  <article className={`message-row message-${message.sender} ${getMessagePerspectiveClass(message.sender, session.role)}`} key={message.id} aria-label={`${message.sender === "system" ? "信箱提醒" : message.sender === session.role ? "我" : message.sender === "admin" ? "倾听员" : conversation.alias}，${formatTime(message.createdAt)}`}>
                    <span className="message-sender">{message.sender === "system" ? "信箱提醒" : message.sender === "admin" ? "倾听员" : conversation.alias}</span>
                    <MessageContent message={message} alias={conversation.alias} viewerRole={session.role} onReply={beginReply} onRecall={handleRecallMessage} recalling={recallingId === message.id} />
                    <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                  </article>
                ))}
              </section>
            ))}
            <span ref={messageEndRef} />
          </div>
          {scrolling.unread && <button type="button" className="new-messages-button" onClick={scrolling.jump}>有新消息 · 回到最新位置 ↓</button>}
          {conversation.status === "closed" ? (
            <div className="conversation-closed-note"><CheckCircle size={22} weight="duotone" /><div><strong>这段会话已经结束</strong><span>你仍然可以查看完整记录，需要时可回到工作台创建新的倾诉。</span></div></div>
          ) : (
            <form className="composer" onSubmit={submit}>
              <label htmlFor="message-input">{session.role === "admin" ? "写下温柔回应" : "把想说的话放在这里"}</label>
              <ReplyComposerPreview message={replyingTo} alias={conversation.alias} viewerRole={session.role} onClear={() => setReplyingTo(null)} />
              <ComposerImagePreview file={image} previewUrl={imagePreview} onClear={() => { if (!busy) setImage(null); }} />
              <SendProgress text={sendProgress} />
              <SendFailureNotice message={failedSend?.error} disabled={busy} onRetry={() => failedSend && sendPayload(failedSend)} />
              <div>
                <textarea disabled={busy} id="message-input" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={session.role === "admin" ? "先接住感受，再慢慢回应…" : "不需要组织得很完整，慢慢说就好…"} rows="3" />
                <label className="image-picker" aria-label="选择一张图片"><PlusCircle size={22} /><input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} /></label>
                <button className="send-button" type="submit" disabled={busy || (!draft.trim() && !image)} aria-label={busy ? "正在发送消息" : "发送消息"}><PaperPlaneTilt size={22} weight="fill" /></button>
              </div>
              <span><LockKey size={15} /> 图片仅对本次会话双方可见；开启 AI 后，倾诉者发送的图片会用于辅助分析 · Ctrl / ⌘ + Enter 发送</span>
              {actionError && <div className="form-message error" role="alert"><WarningCircle size={18} /> {actionError}</div>}
            </form>
          )}
        </section>
        {session.role === "admin" && <details className="full-chat-ai" open>
          <summary>✧ AI 辅助观察 · 展开 / 收起</summary>
          <AiAssistantPanel replyDisabled={busy} conversation={conversation} retrying={retryingAnalysis}
            crisisBusy={crisisBusy} onCrisisAction={handleCrisisUpdate}
            onUseSuggestion={text => { setDraft(current => current.trim() ? `${current}\n\n${text}` : text); document.getElementById("message-input")?.focus(); }}
            onRetry={async () => { if (retryingAnalysis) return; setRetryingAnalysis(true); setActionError(""); try { await retryAiAnalysis(id); } catch (reason) { setActionError(reason.message || "暂时无法重新分析。"); } finally { setRetryingAnalysis(false); } }} />
        </details>}
      </main>
      {confirmingClose && (
        <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirmingClose(false)}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="close-dialog-title" aria-describedby="close-dialog-description">
            <span className="dialog-icon"><XCircle size={28} /></span>
            <h2 id="close-dialog-title">要结束这段会话吗？</h2>
            <p id="close-dialog-description">结束后将保留聊天记录，但不能继续发送消息。需要时可以重新创建一段倾诉。</p>
            <div className="dialog-actions">
              <button className="button button-secondary" type="button" onClick={() => setConfirmingClose(false)} autoFocus>继续聊一会</button>
              <button className="button button-danger" type="button" disabled={busy} onClick={handleClose}>{busy ? "正在结束…" : "确认结束"}</button>
            </div>
          </section>
        </div>
      )}
      {confirmingDelete && (
        <div className="dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !deleting) setConfirmingDelete(false);
        }}>
          <section className="confirm-dialog delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
            <span className="dialog-icon"><Trash size={26} /></span>
            <h2 id="delete-dialog-title">永久删除这段会话？</h2>
            <p id="delete-dialog-description">消息、图片、AI 分析、倾听员标签与危机处理记录都会一并删除，删除后无法恢复。管理员不能替你执行这项操作。</p>
            <label className="delete-confirm-field" htmlFor="delete-confirm-input">
              <span>请输入“删除”以继续</span>
              <input id="delete-confirm-input" value={deletePhrase} disabled={deleting} onChange={(event) => setDeletePhrase(event.target.value)} placeholder="删除" autoFocus />
            </label>
            {deleteError && <div className="form-message error" role="alert"><WarningCircle size={18} /> {deleteError}</div>}
            <div className="dialog-actions">
              <button className="button button-secondary" type="button" disabled={deleting} onClick={() => setConfirmingDelete(false)}>暂不删除</button>
              <button className="button button-danger" type="button" disabled={deletePhrase !== "删除" || deleting} onClick={handleDeleteConversation}>{deleting ? "正在永久删除…" : "确认永久删除"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const intensityLabels = ["较平稳", "轻微", "较明显", "强烈"];

const safetySummaries = {
  normal: {
    label: "暂未发现明显风险",
    detail: "继续倾听，并留意后续表达",
  },
  watch: {
    label: "建议持续留意",
    detail: "结合后续对话尽快人工确认",
  },
  urgent: {
    label: "需要立即人工复核",
    detail: "优先确认安全，并按校方流程处理",
  },
};

function CrisisResponsePanel({ conversation, onUpdate, busy = false }) {
  if (conversation.aiAnalysis?.safetyLevel !== "urgent" || !onUpdate) return null;
  const state = conversation.adminState ?? {};
  const steps = state.crisisSteps ?? {};
  const status = state.crisisStatus ?? "unreviewed";
  const progress = getCrisisCompletion(steps);
  const readyToComplete = canCompleteCrisisHandoff(steps);
  const history = state.crisisHistory ?? [];

  function historyLabel(entry) {
    if (entry.actionKey === "status:resolved") return "标记为已完成交接";
    if (entry.actionKey === "status:reviewing") return "重新打开人工复核";
    const step = crisisSteps.find((item) => item.key === entry.actionKey);
    return step ? `${entry.completed ? "完成" : "取消"}：${step.label}` : "更新危机处理记录";
  }

  return (
    <section className={`crisis-response-panel status-${status}`} aria-label="危机处理流程">
      <header>
        <div><WarningCircle size={21} weight="fill" /><span><strong>人工危机处理</strong><small>心理委员不应独自承担处置</small></span></div>
        <i>{crisisStatusLabels[status] ?? crisisStatusLabels.unreviewed}</i>
      </header>
      <div className="crisis-progress" aria-label={`已完成 ${progress.completed} 项，共 ${progress.total} 项`}><span style={{ width: `${progress.completed / progress.total * 100}%` }} /></div>
      <p className="crisis-intro">AI 只提供风险线索。请回到原始对话人工判断，先确认现实安全，再连接校内与专业支持。</p>
      <div className="crisis-checklist">
        {crisisSteps.map((step) => {
          const completed = Boolean(steps[step.key]);
          return (
            <button key={step.key} type="button" role="checkbox" aria-checked={completed} disabled={busy || status === "resolved"} className={completed ? "completed" : ""} onClick={() => onUpdate({ crisisStep: { key: step.key, completed: !completed } })}>
              <span className="crisis-checkmark">{completed ? <CheckCircle size={20} weight="fill" /> : <i />}</span>
              <span><strong>{step.label}{step.optional ? "（按需）" : ""}</strong><small>{step.detail}</small></span>
            </button>
          );
        })}
      </div>
      <div className="crisis-resources"><strong>现实支持</strong><span><a href="tel:12356">12356 心理援助热线</a> · 存在立即危险时联系 <a href="tel:110">110</a> / <a href="tel:120">120</a></span></div>
      <div className="crisis-actions">
        {status === "resolved" ? (
          <button type="button" disabled={busy} onClick={() => onUpdate({ crisisStatus: "reviewing" })}><ArrowCounterClockwise size={16} /> 重新打开复核</button>
        ) : (
          <button className="complete" type="button" disabled={busy || !readyToComplete} title={!readyToComplete ? "需先完成人工复核、安全确认和校内支持连接" : undefined} onClick={() => onUpdate({ crisisStatus: "resolved" })}><ShieldCheck size={16} /> 标记已完成交接</button>
        )}
      </div>
      <details className="crisis-history">
        <summary>操作记录 · {history.length} 条</summary>
        {history.length ? <ol>{history.map((entry) => <li key={entry.id}><span>{historyLabel(entry)}</span><time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time></li>)}</ol> : <p>尚无人工处理记录。</p>}
      </details>
    </section>
  );
}

function AiAssistantPanel({ conversation, onUseSuggestion, onRetry, onCrisisAction, retrying = false, crisisBusy = false, compact = false, replyDisabled = false }) {
  const analysis = conversation.aiAnalysis;
  const lastClientMessage = conversation.messages.filter((message) => message.sender === "client" && !message.recalledAt).at(-1);
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
  const safetySummary = safetySummaries[analysis.safetyLevel] ?? safetySummaries.normal;
  return (
    <section className={`ai-assistant-panel ${compact ? "compact" : ""} ${urgent ? "urgent" : watch ? "watch" : ""}`} aria-live="polite">
      <div className="ai-panel-heading">
        <span><Sparkle size={18} weight="fill" /> AI 辅助观察</span>
        <i className={`ai-state ${urgent ? "urgent" : watch ? "watch" : "ready"}`}>{urgent ? "立即复核" : watch ? "建议关注" : stale ? "待更新" : "已更新"}</i>
      </div>
      {stale && <p className="ai-stale-note"><WarningCircle size={16} /> 当前提示对应较早消息。<button type="button" disabled={retrying} onClick={onRetry}>{retrying ? "正在重试…" : "重新分析"}</button></p>}
      <p className="ai-source-time">对应消息：{formatTime(conversation.messages.find(message => message.id === analysis.sourceMessageId)?.createdAt || analysis.createdAt)}</p>
      <div className="ai-summary-dock" aria-label="AI 分析核心摘要">
        <article className="ai-summary-card emotion">
          <div className="ai-summary-card-heading"><span className="ai-summary-icon"><Heart size={18} weight="fill" /></span><span>情绪线索</span></div>
          <strong>{analysis.primaryEmotion || "需要进一步倾听"}</strong>
          <small>{intensityLabels[analysis.intensity] ?? "需要确认"}{analysis.secondaryEmotions?.length ? ` · ${analysis.secondaryEmotions.join("、")}` : ""}</small>
        </article>
        <article className={`ai-summary-card risk ${urgent ? "urgent" : watch ? "watch" : "normal"}`}>
          <div className="ai-summary-card-heading"><span className="ai-summary-icon"><ShieldCheck size={18} weight="fill" /></span><span>风险提醒</span></div>
          <strong>{safetySummary.label}</strong>
          <small>{safetySummary.detail}</small>
        </article>
        <article className="ai-summary-card response">
          <div className="ai-summary-card-heading"><span className="ai-summary-icon"><ChatCircleDots size={18} weight="fill" /></span><span>推荐回应</span></div>
          <p>{analysis.suggestedOpening}</p>
          <button type="button" disabled={replyDisabled || conversation.status === "closed"} onClick={() => onUseSuggestion(analysis.suggestedOpening)}>{conversation.status === "closed" ? "会话已结束" : "放入回复草稿"}</button>
          <small className="ai-draft-note">只会填入输入框，不会自动发送</small>
        </article>
      </div>
      <div className="ai-detail-heading"><span>进一步观察</span><small>结合上下文人工判断</small></div>
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
      <CrisisResponsePanel conversation={conversation} onUpdate={onCrisisAction} busy={crisisBusy} />
      {!!analysis.followUpQuestions?.length && <div className="ai-question"><span>可以轻轻追问</span><p>{analysis.followUpQuestions[0]}</p></div>}
      {!!analysis.avoidPhrases?.length && <p className="ai-avoid">尽量避免：{analysis.avoidPhrases.join("、")}</p>}
      <footer><ShieldCheck size={15} /> AI 可能误判，仅供倾听员参考，不构成心理诊断。</footer>
    </section>
  );
}

function AdminDashboard() {
  const { session } = useAuth();
  const { conversations, loading, error } = useConversations();
  const [selectedId, setSelectedId] = useState(() => conversations[0]?.id ?? null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [sendProgress, setSendProgress] = useState("");
  const [failedSend, setFailedSend] = useState(null);
  const [recallingId, setRecallingId] = useState(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [retryingAnalysis, setRetryingAnalysis] = useState(false);
  const [adminStateBusy, setAdminStateBusy] = useState("");
  const [crisisBusy, setCrisisBusy] = useState(false);
  const [mobileAdminView, setMobileAdminView] = useState("inbox");
  const compactAdmin = useMediaQuery("(max-width: 860px)");
  const adminMessageEndRef = useRef(null);
  const filteredConversations = sortAdminConversations(conversations.filter((conversation) => {
    if (!matchesConversationSearch(conversation, search)) return false;
    if (filter === "unread") return getConversationUnreadCount(conversation) > 0;
    if (filter === "waiting") return conversation.status === "waiting";
    if (filter === "closed") return conversation.status === "closed";
    return true;
  }));
  const selected = filteredConversations.find((conversation) => conversation.id === selectedId) ?? filteredConversations[0];
  const selectedUnreadCount = selected ? getConversationUnreadCount(selected) : 0;
  const [draft, setDraft] = useConversationDraft(session.id, "admin", selected?.id);
  const scrolling = useConversationScroll(selected?.id, selected?.messages.length);
  const waitingCount = conversations.filter((conversation) => conversation.status === "waiting").length;
  const unreadCount = conversations.reduce((total, conversation) => total + getConversationUnreadCount(conversation), 0);
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
    if (!selected || selectedUnreadCount === 0) return;
    if (compactAdmin && mobileAdminView !== "conversation") return;
    updateConversationAdminState(selected.id, { markRead: true }).catch(() => {
      setActionError("未读状态暂时无法更新，不影响正常回复。");
    });
  }, [compactAdmin, mobileAdminView, selected?.id, selectedUnreadCount]);


  useEffect(() => setAiPanelOpen(false), [selected?.id]);

  useEffect(() => {
    setImage(null);
    setReplyingTo(null);
    setFailedSend(null);
    setSendProgress("");
    setActionError("");
  }, [selected?.id]);

  async function sendReplyPayload(payload) {
    if (!selected || busy || (!payload.body.trim() && !payload.image)) return;
    setBusy(true);
    setActionError("");
    setFailedSend(null);
    try {
      await sendMessage(selected.id, "admin", payload.body, payload.image, {
        replyToId: payload.replyTo?.id,
        clientMessageId: payload.clientMessageId,
        onProgress: setSendProgress,
      });
      if (draft === payload.body) setDraft("");
      if (image === payload.image) setImage(null);
      if (replyingTo?.id === payload.replyTo?.id) setReplyingTo(null);
      scrolling.jump();
    } catch (reason) {
      setFailedSend({ ...payload, error: reason instanceof Error ? reason.message : "回复发送失败，请稍后再试。" });
    } finally {
      setSendProgress("");
      setBusy(false);
    }
  }

  async function reply(event) {
    event.preventDefault();
    await sendReplyPayload({
      body: draft,
      image,
      replyTo: replyingTo,
      clientMessageId: crypto.randomUUID(),
    });
  }

  function selectConversation(id) {
    setSelectedId(id);
    if (compactAdmin) setMobileAdminView("conversation");
  }

  async function toggleConversationPin(conversation) {
    if (adminStateBusy) return;
    setAdminStateBusy(`pin:${conversation.id}`);
    setActionError("");
    try {
      await updateConversationAdminState(conversation.id, { pinned: !conversation.adminState?.pinned });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法更新置顶状态。");
    } finally {
      setAdminStateBusy("");
    }
  }

  async function toggleConversationTag(conversation, tag) {
    if (adminStateBusy) return;
    const current = conversation.adminState?.tags ?? [];
    const tags = current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 4);
    setAdminStateBusy(`tag:${tag}`);
    setActionError("");
    try {
      await updateConversationAdminState(conversation.id, { tags });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法更新会话标签。");
    } finally {
      setAdminStateBusy("");
    }
  }

  async function updateCrisisResponse(patch) {
    if (!selected || crisisBusy) return;
    setCrisisBusy(true);
    setActionError("");
    try {
      await updateConversationAdminState(selected.id, patch);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法更新危机处理记录。");
    } finally {
      setCrisisBusy(false);
    }
  }

  function beginAdminReply(message) {
    setReplyingTo(message);
    if (compactAdmin) setMobileAdminView("conversation");
    window.requestAnimationFrame(() => document.querySelector(".admin-composer textarea")?.focus());
  }

  async function handleAdminRecall(message) {
    if (!selected || recallingId) return;
    setRecallingId(message.id);
    setActionError("");
    try {
      await recallMessage(selected.id, message.id, "admin");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "暂时无法撤回这条消息。");
    } finally {
      setRecallingId(null);
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
    if (compactAdmin) setMobileAdminView("conversation");
    window.requestAnimationFrame(() => document.querySelector(".admin-composer textarea")?.focus());
  }

  return (
    <div className="app-shell admin-shell">
      <AppHeader title="倾听员工作台" subtitle="所有来访者仅显示匿名代号" />
      <main id="main-content" tabIndex="-1" className="admin-layout">
        <aside className={`conversation-list ${mobileAdminView === "inbox" ? "is-mobile-active" : ""}`}>
          <div className="list-heading"><div><span className="eyebrow"><UsersThree size={17} /> 会话收件箱</span><h2>等待被听见</h2></div><span className="count-badge" role="status" aria-live="polite">{unreadCount} 条未读</span></div>
          <label className="conversation-search">
            <MagnifyingGlass size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="搜索匿名代号、主题或标签" aria-label="搜索会话" />
            {search && <button type="button" aria-label="清空搜索" onClick={() => setSearch("")}><XCircle size={16} weight="fill" /></button>}
          </label>
          <div className="conversation-tabs" aria-label="筛选会话">
            <button className={filter === "all" ? "active" : ""} type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部 <span>{conversations.length}</span></button>
            <button className={filter === "unread" ? "active" : ""} type="button" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>未读 <span>{unreadCount}</span></button>
            <button className={filter === "waiting" ? "active" : ""} type="button" aria-pressed={filter === "waiting"} onClick={() => setFilter("waiting")}>待回复 <span>{waitingCount}</span></button>
            <button className={filter === "closed" ? "active" : ""} type="button" aria-pressed={filter === "closed"} onClick={() => setFilter("closed")}>已结束 <span>{closedCount}</span></button>
          </div>
          <div className="conversation-rows">
            {filteredConversations.map((conversation) => {
              const lastMessage = conversation.messages.at(-1);
              const lastReply = getLastReplyMeta(conversation);
              const unread = getConversationUnreadCount(conversation);
              const riskRank = getConversationRiskRank(conversation);
              return (
                <article className={`conversation-row ${conversation.id === selected?.id ? "selected" : ""} ${riskRank === 2 ? "risk-urgent" : riskRank === 1 ? "risk-watch" : ""}`} key={conversation.id}>
                  <button className="conversation-row-main" type="button" onClick={() => selectConversation(conversation.id)}>
                    <span className="list-avatar"><Cloud size={24} weight="duotone" />{unread > 0 && <i>{unread}</i>}</span>
                    <span className="row-copy">
                      <span className="row-title"><strong>{conversation.alias}</strong>{riskRank > 0 && <i className={`row-risk ${riskRank === 2 ? "urgent" : "watch"}`}>{riskRank === 2 ? "紧急复核" : "建议关注"}</i>}</span>
                      <small>{lastMessage?.recalledAt ? "[消息已撤回]" : lastMessage?.body || (lastMessage?.attachments?.length ? "[图片]" : "")}</small>
                      {!!conversation.adminState?.tags?.length && <span className="row-tags">{conversation.adminState.tags.map((tag) => <i key={tag}>{tag}</i>)}</span>}
                    </span>
                    <span className="row-meta"><time dateTime={lastReply.createdAt}>{lastReply.label} · {formatListTime(lastReply.createdAt)}</time><i className={`status-dot status-${conversation.status}`} /></span>
                  </button>
                  <button className={`conversation-pin ${conversation.adminState?.pinned ? "active" : ""}`} type="button" disabled={Boolean(adminStateBusy)} aria-label={conversation.adminState?.pinned ? `取消置顶 ${conversation.alias}` : `置顶 ${conversation.alias}`} aria-pressed={Boolean(conversation.adminState?.pinned)} onClick={() => toggleConversationPin(conversation)}><PushPin size={16} weight={conversation.adminState?.pinned ? "fill" : "regular"} /></button>
                </article>
              );
            })}
            {loading && !conversations.length && <div className="empty-state"><Cloud size={34} weight="duotone" /><p>正在读取会话…</p></div>}
            {!loading && !filteredConversations.length && <div className="empty-state"><ChatsCircle size={34} /><p>{search ? "没有找到匹配的会话" : filter === "unread" ? "目前没有未读消息" : filter === "waiting" ? "目前没有待回复会话" : filter === "closed" ? "目前没有已结束会话" : "暂时没有新会话"}</p><small>{search ? "试试匿名代号、倾诉主题或已有标签" : "切换上方筛选可查看其他会话"}</small></div>}
            {error && <div className="list-error"><WarningCircle size={17} /> {error}</div>}
          </div>
        </aside>
        <section className={`admin-conversation ${mobileAdminView === "conversation" ? "is-mobile-active" : ""}`}>
          {selected ? (
            <>
              <header><div><span className="avatar-cloud small"><Cloud size={28} weight="duotone" /></span><div><h2>{selected.alias}</h2><p>{selected.topic} · {statusLabels[selected.status]}</p></div></div><Link className="button button-secondary compact-button" to={`/chat/${selected.id}`}>打开完整会话</Link></header>
              <button className={`ai-status-bar ${selected.aiAnalysis?.safetyLevel === "urgent" ? "urgent" : selected.aiAnalysis?.safetyLevel === "watch" ? "watch" : ""}`} type="button" onClick={() => compactAdmin ? setMobileAdminView("insights") : setAiPanelOpen((open) => !open)} aria-expanded={compactAdmin ? mobileAdminView === "insights" : aiPanelOpen}>
                <span><Sparkle size={18} weight="fill" /><strong>AI 辅助观察</strong></span>
                <span>{!selected.aiAssistanceEnabled ? "倾诉者未开启" : selected.aiAnalysis?.status === "pending" ? "正在分析最新消息…" : selected.aiAnalysis?.status === "failed" ? "分析暂时失败" : selected.aiAnalysis?.status === "ready" ? `可能感到：${selected.aiAnalysis.primaryEmotion} · ${selected.aiAnalysis.currentNeed}` : "等待倾诉消息"}</span>
                <small>{compactAdmin ? "打开 AI" : aiPanelOpen ? "收起" : "查看建议"}</small>
              </button>
              {aiPanelOpen && <div className="ai-inline-panel"><AiAssistantPanel replyDisabled={busy} conversation={selected} onUseSuggestion={useAiSuggestion} onRetry={retrySelectedAnalysis} onCrisisAction={updateCrisisResponse} retrying={retryingAnalysis} crisisBusy={crisisBusy} compact /></div>}
              <div className="admin-messages" ref={scrolling.ref} onScroll={scrolling.onScroll} role="log" aria-live="polite" aria-relevant="additions text" aria-label={`${selected.alias} 的消息记录`} tabIndex="0">
                {groupMessagesByDate(selected.messages).map((group) => (
                  <section className="message-day-group" key={group.key} aria-label={formatConversationDate(group.date)}>
                    <h3 className="chat-day">{formatConversationDate(group.date)}</h3>
                    {group.messages.map((message) => (
                      <article className={`message-row message-${message.sender} ${getMessagePerspectiveClass(message.sender, "admin")}`} key={message.id} aria-label={`${message.sender === "system" ? "信箱提醒" : message.sender === "admin" ? "我" : selected.alias}，${formatTime(message.createdAt)}`}>
                        <span className="message-sender">{message.sender === "system" ? "信箱提醒" : message.sender === "admin" ? "我" : selected.alias}</span>
                        <MessageContent message={message} alias={selected.alias} viewerRole="admin" onReply={beginAdminReply} onRecall={handleAdminRecall} recalling={recallingId === message.id} />
                        <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
                      </article>
                    ))}
                  </section>
                ))}
                <span ref={adminMessageEndRef} />
              </div>
              {scrolling.unread && <button type="button" className="new-messages-button" onClick={scrolling.jump}>有新消息 · 回到最新位置 ↓</button>}
              {selected.status === "closed" ? (
                <div className="conversation-closed-note compact"><CheckCircle size={22} weight="duotone" /><div><strong>这段会话已结束</strong><span>记录保留为只读，不能继续回复。</span></div></div>
              ) : (
                <form className="admin-composer" onSubmit={reply}>
                  <ReplyComposerPreview message={replyingTo} alias={selected.alias} viewerRole="admin" onClear={() => setReplyingTo(null)} />
                  <ComposerImagePreview file={image} previewUrl={imagePreview} onClear={() => { if (!busy) setImage(null); }} />
                  <SendProgress text={sendProgress} />
                  <SendFailureNotice message={failedSend?.error} disabled={busy} onRetry={() => failedSend && sendReplyPayload(failedSend)} />
                  <textarea disabled={busy} aria-label="回复内容" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleReplyKeyDown} rows="3" placeholder="先接住情绪，再慢慢回应…" />
                  {actionError && <div className="form-message error"><WarningCircle size={18} /> {actionError}</div>}
                  <div><span><ShieldCheck size={17} /> 不诊断、不评判 · 图片仅会话双方可见</span><span className="admin-composer-actions"><label className="button button-secondary compact-button image-action"><PlusCircle size={17} /> 添加图片<input disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={selectReplyImage} /></label><button className="button button-primary" disabled={busy || (!draft.trim() && !image)} type="submit">{busy ? "发送中…" : "发送回复"} <PaperPlaneTilt size={18} weight="fill" /></button></span></div>
                </form>
              )}
            </>
          ) : <div className="empty-state large">{error ? <><WarningCircle size={48} /><h2>{error}</h2></> : <><ChatsCircle size={48} /><h2>选择一段会话开始倾听</h2></>}</div>}
        </section>
        {selected && (
          <aside className={`admin-details ${mobileAdminView === "insights" ? "is-mobile-active" : ""}`}>
            <div className="admin-profile-summary">
              <span className="eyebrow"><LockKey size={17} /> 匿名资料</span>
              <h3>{selected.alias}</h3>
              <p>系统不会向倾听员展示邮箱、真实姓名或登录方式。</p>
              <div className="conversation-organizer">
                <div className="organizer-heading"><span><Tag size={16} /> 会话整理</span><button type="button" disabled={Boolean(adminStateBusy)} className={selected.adminState?.pinned ? "active" : ""} aria-pressed={Boolean(selected.adminState?.pinned)} onClick={() => toggleConversationPin(selected)}><PushPin size={15} weight={selected.adminState?.pinned ? "fill" : "regular"} />{selected.adminState?.pinned ? "已置顶" : "置顶"}</button></div>
                <div className="conversation-tag-options" aria-label="会话标签">
                  {conversationTagOptions.map((tag) => {
                    const active = selected.adminState?.tags?.includes(tag);
                    return <button key={tag} type="button" disabled={Boolean(adminStateBusy)} className={active ? "active" : ""} aria-pressed={Boolean(active)} onClick={() => toggleConversationTag(selected, tag)}>{tag}</button>;
                  })}
                </div>
              </div>
              <dl><div><dt>当前状态</dt><dd>{statusLabels[selected.status]}</dd></div><div><dt>倾诉主题</dt><dd>{selected.topic}</dd></div><div><dt>希望得到</dt><dd>{selected.need}</dd></div><div><dt>消息数量</dt><dd>{selected.messages.length} 条</dd></div></dl>
            </div>
            <AiAssistantPanel replyDisabled={busy} conversation={selected} onUseSuggestion={useAiSuggestion} onRetry={retrySelectedAnalysis} onCrisisAction={updateCrisisResponse} retrying={retryingAnalysis} crisisBusy={crisisBusy} />
            <div className="admin-reminder"><Heart size={21} weight="fill" /><p>先回应感受，再询问事实。允许沉默，也允许用户暂停。</p></div>
          </aside>
        )}
        <nav className="mobile-admin-nav" aria-label="管理员工作视图">
          <button type="button" className={mobileAdminView === "inbox" ? "active" : ""} aria-pressed={mobileAdminView === "inbox"} onClick={() => setMobileAdminView("inbox")}><UsersThree size={22} weight={mobileAdminView === "inbox" ? "fill" : "regular"} /><span>会话</span>{unreadCount > 0 && <i>{unreadCount}</i>}</button>
          <button type="button" disabled={!selected} className={mobileAdminView === "conversation" ? "active" : ""} aria-pressed={mobileAdminView === "conversation"} onClick={() => setMobileAdminView("conversation")}><ChatsCircle size={22} weight={mobileAdminView === "conversation" ? "fill" : "regular"} /><span>对话</span></button>
          <button type="button" disabled={!selected} className={mobileAdminView === "insights" ? "active" : ""} aria-pressed={mobileAdminView === "insights"} onClick={() => setMobileAdminView("insights")}><Sparkle size={22} weight={mobileAdminView === "insights" ? "fill" : "regular"} /><span>AI</span>{selected?.aiAnalysis?.safetyLevel === "urgent" && <i className="urgent-dot">!</i>}</button>
        </nav>
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
      <main id="main-content" tabIndex="-1" className="not-found-page">
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

function RouteAccessibility() {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (previousPath.current === pathname) return undefined;
    previousPath.current = pathname;
    const frame = window.requestAnimationFrame(() => {
      const main = document.getElementById("main-content");
      const title = document.querySelector(".app-header h1, main h1")?.textContent?.trim() || document.title;
      setAnnouncement(`已打开：${title}`);
      main?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>;
}

function MotionReveals() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    let observer;
    const frame = window.requestAnimationFrame(() => {
      const targets = document.querySelectorAll([
        ".trust-strip > *",
        ".tips-section > .section-heading",
        ".tip-grid > *",
        ".content-page > .section-heading",
        ".about-page > *",
        ".privacy-grid > *",
        ".dashboard-layout > *",
        ".safety-note",
        ".site-footer > *",
      ].join(","));
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -28px" });
      targets.forEach((target, index) => {
        target.classList.add("motion-reveal");
        target.style.setProperty("--reveal-order", String(index % 4));
        observer.observe(target);
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [pathname]);
  return null;
}

function AppRoutes() {
  const { authCallback, authError, clearAuthError, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="screen-loader"><Cloud size={34} weight="duotone" /> 正在确认邀请…</div>;
  if (authCallback?.type === "invite" && authCallback.token) {
    return <InviteAcceptPage token={authCallback.token} />;
  }
  if (authCallback?.type === "recovery") return <PasswordResetPage />;
  if (authError) return <AuthCallbackErrorPage message={authError} onDismiss={clearAuthError} />;

  return (
    <>
      <HashScroll />
      <MotionReveals />
      <RouteAccessibility />
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className="route-stage" key={location.pathname}>
      <Routes location={location}>
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
      </div>
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
