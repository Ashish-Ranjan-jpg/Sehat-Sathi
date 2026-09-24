import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Home,
  User,
  Users,
  UploadCloud,
  LogOut,
  Search,
  Plus,
  ArrowLeft,
  FileText,
  Download,
  Trash2,
  Edit3,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Camera,
  Check,
  Image as ImageIcon,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Copy,
  Pill,
  ClipboardList,
  Eye,
  EyeOff,
  Menu,
  LayoutDashboard,
  ShieldCheck,
  UserCog,
  Activity,
  BarChart2,
  Globe,
  Settings,
  BadgeCheck,
  Ban,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Grid,
  List,
  Phone,
  Send,
  Mic,
  MicOff,
  Bot,
  MessageSquare,
  Loader2,
  ShieldAlert,
  AlertTriangle,
  PhoneCall,
  Navigation,
  MapPin,
  Crosshair,
  Share2,
  HeartPulse,
  ExternalLink,
  LifeBuoy,
  Bell,
  Clock,
  Calendar,
  UserCheck,
  CheckSquare,
  AlarmClock,
} from "lucide-react";
import { api, getToken, clearToken } from "./api";
import { SUPPORTED_LANGUAGES, t as translate } from "./i18n";

// ---------------------------------------------------------------------------
// GLOBAL LANGUAGE CONTEXT & SELECTOR
// ---------------------------------------------------------------------------

const LanguageContext = React.createContext({
  language: "hi",
  setLanguage: () => {},
  t: (key) => translate(key, "hi"),
});

function useAppLanguage() {
  return React.useContext(LanguageContext);
}

function LanguageSelector({ compact = false }) {
  const { language, setLanguage } = useAppLanguage();

  return (
    <div className={`lang-selector-wrap ${compact ? "lang-selector--compact" : ""}`}>
      <Globe size={compact ? 12 : 14} className="lang-globe-icon" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="lang-select-dropdown"
        title="Select App Language / भाषा चुनें"
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {compact ? `${l.flag} ${l.code.toUpperCase()}` : `${l.flag} ${l.name}`}
          </option>
        ))}
      </select>
    </div>
  );
}

// Supported languages matching pipeline codes
const LANGUAGES = SUPPORTED_LANGUAGES;

function getLanguageName(codeOrName) {
  if (!codeOrName) return "Hindi";
  const found = LANGUAGES.find(
    (l) => l.code.toLowerCase() === codeOrName.toLowerCase() || l.name.toLowerCase() === codeOrName.toLowerCase()
  );
  return found ? found.name : codeOrName;
}

function getLanguageCode(codeOrName) {
  if (!codeOrName) return "hi";
  const found = LANGUAGES.find(
    (l) => l.code.toLowerCase() === codeOrName.toLowerCase() || l.name.toLowerCase() === codeOrName.toLowerCase()
  );
  return found ? found.code : "hi";
}

// ---------------------------------------------------------------------------
// GLOBAL TOAST + CONFIRM SYSTEM
// ---------------------------------------------------------------------------

let _setToasts = null;
let _setConfirmState = null;

function toast(message, type = "success") {
  if (_setToasts) {
    const id = Date.now() + Math.random();
    _setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      _setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }
}

function showConfirm({ title, message, onConfirm, confirmLabel = "Confirm", danger = false }) {
  if (_setConfirmState) {
    _setConfirmState({ open: true, title, message, onConfirm, confirmLabel, danger });
  }
}

// ---------------------------------------------------------------------------
// SHARED PIECES
// ---------------------------------------------------------------------------

function BrandMark({ light, onClick, size, style }) {
  return (
    <span
      className="ss-wordmark"
      onClick={onClick}
      style={{
        color: light ? "#EFEAD9" : "var(--ink)",
        ...(size ? { fontSize: size } : {}),
        cursor: onClick ? "pointer" : "inherit",
        ...style
      }}
    >
      Sehat Saathi
    </span>
  );
}

function PageTransition({ children }) {
  return <div className="page-transition">{children}</div>;
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const { t } = useAppLanguage();

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast("Failed to copy: " + err.message, "error");
    }
  }

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? "copy-btn--copied" : ""}`}
      onClick={handleCopy}
      title={t("common.copyToClipboard")}
    >
      {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
      <span>{copied ? t("common.copied") : t("common.copy")}</span>
    </button>
  );
}

function getDocTypeIcon(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("prescription") || t.includes("rx") || t.includes("med")) {
    return <Pill size={20} strokeWidth={2} />;
  }
  if (t.includes("discharge") || t.includes("summary") || t.includes("report")) {
    return <ClipboardList size={20} strokeWidth={2} />;
  }
  return <FileText size={20} strokeWidth={2} />;
}

function PasswordField({
  label = "Password",
  value,
  onChange,
  placeholder = "••••••••",
  required = true,
  hint,
  autoComplete = "current-password",
  id,
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="password-toggle-btn"
          onClick={() => setShow((prev) => !prev)}
          title={show ? "Hide password" : "Show password"}
          aria-label={show ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {show ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
        </button>
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

function PasswordStrengthIndicator({ password }) {
  const safePassword = password || "";
  const isActive = safePassword.length > 0;

  const requirements = [
    { id: "length", label: "At least 8 characters", met: safePassword.length >= 8 },
    { id: "number", label: "At least 1 number (0-9)", met: /\d/.test(safePassword) },
    { id: "upper", label: "At least 1 uppercase letter (A-Z)", met: /[A-Z]/.test(safePassword) },
    { id: "lower", label: "At least 1 lowercase letter (a-z)", met: /[a-z]/.test(safePassword) },
    { id: "special", label: "At least 1 special character (!@#$...)", met: /[^A-Za-z0-9]/.test(safePassword) },
  ];

  const metCount = requirements.filter((r) => r.met).length;

  let strengthClass = "weak";
  let strengthLabel = "Weak";
  let percent = 20;

  if (safePassword.length < 8) {
    strengthClass = "weak";
    strengthLabel = "Needs at least 8 characters";
    percent = Math.min(25, (safePassword.length / 8) * 25);
  } else if (metCount <= 2) {
    strengthClass = "weak";
    strengthLabel = "Weak";
    percent = 40;
  } else if (metCount === 3) {
    strengthClass = "medium";
    strengthLabel = "Fair";
    percent = 65;
  } else if (metCount === 4) {
    strengthClass = "good";
    strengthLabel = "Good";
    percent = 85;
  } else {
    strengthClass = "strong";
    strengthLabel = "Strong";
    percent = 100;
  }

  return (
    <div className={`pwd-strength-container ${isActive ? "is-active" : ""}`}>
      <div className="pwd-strength-box">
        <div className="pwd-strength-header">
          <span className="pwd-strength-title">{t("auth.passwordStrength")}</span>
          <span className={`pwd-strength-label pwd-strength-label--${strengthClass}`}>
            {strengthLabel}
          </span>
        </div>

        <div className="pwd-strength-meter">
          <div
            className={`pwd-strength-bar pwd-strength-bar--${strengthClass}`}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="pwd-reqs-list">
          {requirements.map((req) => (
            <div
              key={req.id}
              className={`pwd-req-item ${req.met ? "pwd-req-item--met" : ""}`}
            >
              <span className="pwd-req-icon">
                {req.met ? <Check size={11} strokeWidth={3} /> : "•"}
              </span>
              <span>{req.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// GlobalModals — renders at app root level
function PWAInstallBanner() {
  const { t } = useAppLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    function handleBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    function handleOnline() { setIsOffline(false); }
    function handleOffline() { setIsOffline(true); }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("[PWA] Installation outcome:", outcome);
    setDeferredPrompt(null);
    setDismissed(true);
  }

  return (
    <>
      {isOffline && (
        <div className="pwa-offline-banner">
          <AlertCircle size={15} />
          <span>{t("pwa.offlineBadge")}</span>
        </div>
      )}

      {deferredPrompt && !dismissed && (
        <div className="pwa-install-banner">
          <div className="pwa-install-banner__icon">
            <img src="/icons/icon-192x192.png" alt="Sehat Saathi App Icon" width={36} height={36} style={{ borderRadius: 8 }} />
          </div>
          <div className="pwa-install-banner__info">
            <div className="pwa-install-banner__title">{t("pwa.installTitle")}</div>
            <div className="pwa-install-banner__sub">{t("pwa.installSub")}</div>
          </div>
          <div className="pwa-install-banner__actions">
            <button type="button" className="btn btn--primary btn--sm" onClick={handleInstall}>
              <Download size={14} /> {t("pwa.installBtn")}
            </button>
            <button type="button" className="pwa-dismiss-btn" onClick={() => setDismissed(true)} title={t("common.close")}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function GlobalModals() {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState({ open: false });

  useEffect(() => {
    _setToasts = setToasts;
    _setConfirmState = setConfirm;
    return () => { _setToasts = null; _setConfirmState = null; };
  }, []);

  return (
    <>
      <PWAInstallBanner />
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.type === "success" && <CheckCircle2 size={15} />}
            {t.type === "error" && <AlertCircle size={15} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {confirm.open && (
        <div className="modal-backdrop" onClick={() => setConfirm({ open: false })}>
          <div className="modal-card confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm-modal__icon ${confirm.danger ? "confirm-modal__icon--danger" : "confirm-modal__icon--info"}`}>
              {confirm.danger ? <Trash2 size={22} /> : <AlertCircle size={22} />}
            </div>
            <h3>{confirm.title || (confirm.danger ? "Are you sure?" : "Confirm action")}</h3>
            <p>{confirm.message}</p>
            <div className="confirm-modal__actions">
              <button className="btn btn--secondary" onClick={() => setConfirm({ open: false })}>
                Cancel
              </button>
              <button
                className="btn btn--primary"
                style={confirm.danger ? { background: "var(--brick)", borderColor: "var(--brick)" } : {}}
                onClick={() => {
                  confirm.onConfirm?.();
                  setConfirm({ open: false });
                }}
              >
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusDot({ status }) {
  const isReady = status === "ready" || !status || status === "processed";
  return (
    <span className={`status ${isReady ? "ready" : "processing"}`}>
      <span className="dot" />
      {isReady ? "Ready" : "Processing"}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LANDING SCREEN COMPONENT
// ---------------------------------------------------------------------------

function LandingScreen({ onGoLogin, onGoRegister }) {
  const cardsRef = useRef([]);
  const { t } = useAppLanguage();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.15 }
    );

    cardsRef.current.forEach((card) => {
      if (card) observer.observe(card);
    });

    return () => observer.disconnect();
  }, []);

  const features = [
    {
      id: "ocr",
      badge: t("landing.smartOCRTitle"),
      title: t("landing.smartOCRTitle"),
      text: t("landing.smartOCRText"),
      icon: <FileText size={20} />,
      imageSrc: "/images/landing-ocr.jpg",
      tags: ["Prescriptions", "Lab Reports", "Discharge Summaries"],
    },
    {
      id: "simplify",
      badge: t("landing.jargonBadge"),
      title: t("landing.jargonTitle"),
      text: t("landing.jargonText"),
      icon: <CheckCircle2 size={20} />,
      imageSrc: "/images/landing-simplify.jpg",
      tags: ["Clear Terms", "Dosage Instructions", "Patient-Friendly"],
    },
    {
      id: "audio",
      badge: t("landing.audioBadge"),
      title: t("landing.audioAssistanceTitle"),
      text: t("landing.audioAssistanceText"),
      icon: <Volume2 size={20} />,
      imageSrc: "/images/landing-audio.jpg",
      tags: ["Text-to-Speech", "Native Dialects", "Accessible Audio"],
    },
    {
      id: "portal",
      badge: t("landing.workerBadge"),
      title: t("landing.workerPortalTitle"),
      text: t("landing.workerPortalText"),
      icon: <Users size={20} />,
      imageSrc: "/images/landing-portal.jpg",
      tags: ["Multi-Patient", "Worker Tools", "Pipeline Inspector"],
    },
  ];

  return (
    <div className="landing-page">
      {/* Sticky Navigation Header */}
      <nav className="landing-nav">
        <div className="landing-nav__brand">
          <BrandMark />
        </div>
        <ul className="landing-nav__links">
          <li><a href="#features">{t("nav.healthLibrary")}</a></li>
          <li><a href="#how-it-works">{t("landing.howItWorks")}</a></li>
          <li><a href="#about">{t("nav.overview")}</a></li>
        </ul>
        <div className="landing-nav__actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LanguageSelector />
          <button className="btn btn--secondary" onClick={onGoLogin} style={{ padding: "8px 16px", fontSize: 13 }}>
            {t("nav.login")}
          </button>
          <button className="btn btn--primary" onClick={onGoRegister} style={{ padding: "8px 18px", fontSize: 13 }}>
            {t("landing.getStarted")} <ArrowLeft size={14} style={{ transform: "rotate(180deg)", verticalAlign: "middle", marginLeft: 4 }} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div>
          <div className="landing-hero__badge">
            <Sparkles size={14} /> {t("landing.badge")}
          </div>
          <h1 className="landing-hero__title">
            {t("landing.heroTitle")}
          </h1>
          <p className="landing-hero__subtitle">
            {t("landing.heroSubtitle")}
          </p>
          <div className="landing-hero__cta">
            <button className="btn btn--primary" onClick={onGoRegister} style={{ padding: "12px 24px", fontSize: 15 }}>
              {t("landing.getStarted")}
            </button>
            <button className="btn btn--secondary" onClick={onGoLogin} style={{ padding: "12px 20px", fontSize: 15 }}>
              {t("landing.loginNow")}
            </button>
          </div>
        </div>

        {/* Hero Image Container */}
        <div className="landing-hero__image-wrap">
          <img
            src="/images/landing-hero.jpg"
            alt="Sehat Saathi Medical Preview"
            className="landing-hero__img"
            onError={(e) => {
              e.target.style.display = "none";
              if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
            }}
          />
          <div className="landing-hero__fallback" style={{ display: "none" }}>
            <BrandMark light />
            <p style={{ marginTop: 12, fontSize: 14, opacity: 0.9 }}>
              Upload your custom hero photo to <code>/images/landing-hero.jpg</code>
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Stats Bar */}
      <div className="landing-trust-bar">
        <div className="landing-trust-grid">
          <div className="landing-trust-item">
            <div className="landing-trust-icon"><FileText size={20} /></div>
            <div className="landing-trust-text">
              <h4>{t("landing.smartOCRTitle")}</h4>
              <p>{t("landing.smartOCRText")}</p>
            </div>
          </div>
          <div className="landing-trust-item">
            <div className="landing-trust-icon"><Globe size={20} /></div>
            <div className="landing-trust-text">
              <h4>{t("landing.multilingualTitle")}</h4>
              <p>{t("landing.multilingualText")}</p>
            </div>
          </div>
          <div className="landing-trust-item">
            <div className="landing-trust-icon"><Volume2 size={20} /></div>
            <div className="landing-trust-text">
              <h4>{t("landing.audioAssistanceTitle")}</h4>
              <p>{t("landing.audioAssistanceText")}</p>
            </div>
          </div>
          <div className="landing-trust-item">
            <div className="landing-trust-icon"><ShieldCheck size={20} /></div>
            <div className="landing-trust-text">
              <h4>{t("landing.reminderSystemTitle")}</h4>
              <p>{t("landing.reminderSystemText")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll-Unfolding Features Section */}
      <section id="features" className="landing-section">
        <div className="landing-section__header">
          <span className="landing-section__badge">{t("landing.badge")}</span>
          <h2 className="landing-section__title">{t("landing.featuresTitle")}</h2>
          <p className="landing-section__subtitle">
            {t("landing.featuresSubtitle")}
          </p>
        </div>

        <div className="unfold-grid">
          {features.map((f, idx) => (
            <div
              key={f.id}
              ref={(el) => (cardsRef.current[idx] = el)}
              className="unfold-card"
            >
              {/* Feature Image Slot */}
              <div className="unfold-card__image-slot">
                <img
                  src={f.imageSrc}
                  alt={f.title}
                  className="unfold-card__img"
                  onError={(e) => {
                    e.target.style.display = "none";
                    if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                  }}
                />
                <div className="unfold-card__img-fallback" style={{ display: "none" }}>
                  <div className="unfold-card__icon" style={{ margin: "0 auto 8px" }}>{f.icon}</div>
                  <strong style={{ fontSize: 14 }}>{f.title}</strong>
                  <span style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 4 }}>
                    Slot: <code>{f.imageSrc}</code>
                  </span>
                </div>
              </div>

              <div className="unfold-card__content">
                <div className="unfold-card__icon-header">
                  <div className="unfold-card__icon">{f.icon}</div>
                  <span className="badge badge--teal">{f.badge}</span>
                </div>
                <h3 className="unfold-card__title">{f.title}</h3>
                <p className="unfold-card__text">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-section" style={{ background: "var(--panel)", borderTop: "1px solid var(--border-soft)" }}>
        <div className="landing-section__header">
          <span className="landing-section__badge">{t("landing.howItWorks")}</span>
          <h2 className="landing-section__title">{t("landing.howItWorks")}</h2>
          <p className="landing-section__subtitle">
          {t("landing.howItWorksSub")}
          </p>
        </div>

        <div className="workflow-grid">
          <div className="workflow-card">
            <div className="workflow-card__number">1</div>
            <h3 className="workflow-card__title">{t("landing.step1Title")}</h3>
            <p className="workflow-card__text">
              {t("landing.step1Text")}
            </p>
          </div>
          <div className="workflow-card">
            <div className="workflow-card__number">2</div>
            <h3 className="workflow-card__title">{t("landing.step2Title")}</h3>
            <p className="workflow-card__text">
              {t("landing.step2Text")}
            </p>
          </div>
          <div className="workflow-card">
            <div className="workflow-card__number">3</div>
            <h3 className="workflow-card__title">{t("landing.step3Title")}</h3>
            <p className="workflow-card__text">
              {t("landing.step3Text")}
            </p>
          </div>
        </div>

        {/* CTA Banner */}
        <div id="about" className="landing-cta-banner">
          <h2>{t("landing.ctaTitle")}</h2>
          <p>
            {t("landing.ctaSubtitle")}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn btn--primary" onClick={onGoRegister} style={{ padding: "12px 28px", fontSize: 15 }}>
              {t("nav.createAccount")}
            </button>
            <button className="btn btn--secondary" onClick={onGoLogin} style={{ padding: "12px 24px", fontSize: 15, background: "rgba(255,255,255,0.15)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.3)" }}>
              {t("nav.login")}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          <BrandMark />
        </div>
        <p style={{ margin: 0 }}>
          {t("landing.footerTagline")}
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AUTH SCREENS
// ---------------------------------------------------------------------------

function LoginScreen({ onLoginSuccess, onGoRegister, onGoLanding }) {
  const { t } = useAppLanguage();
  const [role, setRole] = useState("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      if (res.user.role !== role) {
        api.logout();
        const roleNames = { patient: t("role.patient"), healthcare_worker: t("role.worker"), admin: t("role.admin") };
        setError(`This account is registered as ${roleNames[res.user.role] || res.user.role}. Please select the ${roleNames[res.user.role] || res.user.role} role tab to log in.`);
        return;
      }
      onLoginSuccess(res.user, res.profile);
    } catch (err) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-panel__hero-img">
          <img src="/images/auth-hero.jpg" alt="Sehat Saathi hero" className="auth-hero-img" />
          <div className="auth-panel__hero-overlay" />
        </div>
        <div className="auth-panel__brand"><BrandMark light onClick={onGoLanding} /></div>
        <div className="auth-panel__copy">
          <h2>{t("landing.heroTitle")}</h2>
          <p>
            Upload a prescription or discharge summary and get it back simplified
            and translated — so the people relying on it can actually understand it.
          </p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h1>{t("nav.login")}</h1>
          <p className="lead">{t("auth.welcomeBack")}</p>

          {error && (
            <div className="alert alert--error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="role-toggle">
            <button
              type="button"
              className={role === "patient" ? "active" : ""}
              onClick={() => setRole("patient")}
            >
              {t("role.patient")}
            </button>
            <button
              type="button"
              className={role === "healthcare_worker" ? "active" : ""}
              onClick={() => setRole("healthcare_worker")}
            >
              {t("role.worker")}
            </button>
            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => setRole("admin")}
            >
              {t("role.admin")}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <Field label={t("auth.emailLabel")}>
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <PasswordField
              label={t("auth.passwordLabel")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button type="submit" className="btn btn--primary btn--block" disabled={loading} style={{ marginTop: 12 }}>
              {loading ? <span className="spinner" /> : t("nav.login")}
            </button>
          </form>

          <p className="auth-switch">
            New here?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); onGoRegister(); }} style={{ color: "var(--teal)", fontWeight: 600 }}>
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ onRegisterSuccess, onGoLogin, onGoLanding }) {
  const { t } = useAppLanguage();
  const [role, setRole] = useState("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Female");
  const [preferredLang, setPreferredLang] = useState("Hindi");

  // Health worker specific
  const [inviteCode, setInviteCode] = useState("HOSPITAL-Fn_DaOCz0Ak2Kq0l");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in email and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      email,
      password,
      role,
      name: name || undefined,
      phone_number: phone || undefined,
    };

    if (role === "patient") {
      payload.age = age ? parseInt(age, 10) : undefined;
      payload.gender = gender;
      payload.preferred_language = preferredLang;
    } else if (role === "admin") {
      payload.invite_code = inviteCode;
    } else {
      payload.invite_code = inviteCode;
      payload.employee_id = employeeId || undefined;
      payload.department = department || undefined;
    }

    try {
      const res = await api.register(payload);
      onRegisterSuccess(res.user, res.profile);
    } catch (err) {
      setError(err.message || "Registration failed. Please check your information.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-panel__hero-img">
          <img src="/images/auth-hero.jpg" alt="Sehat Saathi hero" className="auth-hero-img" />
          <div className="auth-panel__hero-overlay" />
        </div>
        <div className="auth-panel__brand"><BrandMark light onClick={onGoLanding} /></div>
        <div className="auth-panel__copy">
          <h2>{t("auth.builtFor")}</h2>
          <p>
            Whether you're a patient managing your own care or a health worker
            supporting several families, your documents and their history stay
            in one place.
          </p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card" style={{ maxWidth: 420 }}>
          <h1>{t("nav.createAccount")}</h1>
          <p className="lead">{t("auth.takesAMinute")}</p>

          {error && (
            <div className="alert alert--error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="role-toggle">
            <button
              type="button"
              className={role === "patient" ? "active" : ""}
              onClick={() => setRole("patient")}
            >
              {t("role.patient")}
            </button>
            <button
              type="button"
              className={role === "healthcare_worker" ? "active" : ""}
              onClick={() => setRole("healthcare_worker")}
            >
              {t("role.worker")}
            </button>
            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => setRole("admin")}
            >
              {t("role.admin")}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <Field label={t("profile.fullName")}>
              <input
                type="text"
                placeholder={t("auth.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label={t("auth.emailLabel")}>
              <input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <PasswordField
              label={t("auth.createPasswordLabel")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              hint={t("auth.passwordMinLength")}
            />
            <PasswordStrengthIndicator password={password} />

            {role === "patient" ? (
              <>
                <div className="field-row">
                  <Field label={t("profile.age")}>
                    <input
                      type="number"
                      placeholder={t("auth.agePlaceholder")}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </Field>
                  <Field label={t("profile.gender")}>
                    <select value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="Female">{t("auth.genderFemale")}</option>
                      <option value="Male">{t("auth.genderMale")}</option>
                      <option value="Other">{t("auth.genderOther")}</option>
                    </select>
                  </Field>
                </div>
                <Field label={t("profile.phone")}>
                  <input
                    type="tel"
                    placeholder={t("auth.phonePlaceholder")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field label={t("dashboard.preferredLang")} hint={t("profile.langSettingsSub")}>
                  <select value={preferredLang} onChange={(e) => setPreferredLang(e.target.value)}>
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : role === "admin" ? (
              <Field
                label={t("auth.adminKeyLabel")}
                hint={t("auth.adminKeyHint")}
              >
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder={t("auth.adminCodePlaceholder")}
                  required
                />
              </Field>
            ) : (
              <>
                <Field
                  label={t("auth.hospitalCodeLabel")}
                  hint={t("auth.hospitalCodeHint")}
                >
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder={t("auth.hospitalCodePlaceholder")}
                    required
                  />
                </Field>
                <div className="field-row">
                  <Field label={t("auth.empIdLabel")}>
                    <input
                      type="text"
                      placeholder={t("auth.empIdPlaceholder")}
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                    />
                  </Field>
                  <Field label={t("auth.deptLabel")}>
                    <input
                      type="text"
                      placeholder={t("auth.deptPlaceholder")}
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label={t("profile.phone")}>
                  <input
                    type="tel"
                    placeholder={t("auth.phonePlaceholder")}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </>
            )}

            <button type="submit" className="btn btn--primary btn--block" disabled={loading} style={{ marginTop: 12 }}>
              {loading ? <span className="spinner" /> : t("nav.createAccount")}
            </button>
          </form>

          <p className="auth-switch">
            {t("auth.alreadyHaveAccount")}{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); onGoLogin(); }} style={{ color: "var(--teal)", fontWeight: 600 }}>
              {t("nav.login")}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IN-APP NOTIFICATION BELL & DROPDOWN DRAWER
// ---------------------------------------------------------------------------

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // AudioContext autoplay restriction safeguard
  }
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const cleanStr = dateStr.replace("Z", "");
    const date = new Date(cleanStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (isNaN(diffSec) || diffSec < 0) return "Just now";
    if (diffSec < 30) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch (e) {
    return dateStr;
  }
}

function NotificationBellDrawer({ onNav }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const prevUnreadRef = useRef(0);
  const drawerRef = useRef(null);
  const { t } = useAppLanguage();

  const fetchNotifications = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await api.notifications.list(50);
      const list = res.notifications || [];
      const newUnread = res.unread_count || 0;

      // Check if unread count increased -> trigger audio chime and toast
      if (!isInitial && newUnread > prevUnreadRef.current) {
        playNotificationChime();
        const latest = list[0];
        if (latest && !latest.is_read) {
          toast(`${latest.title}: ${latest.message}`);
        }
      }

      prevUnreadRef.current = newUnread;
      setNotifications(list);
      setUnreadCount(newUnread);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(true);

    // Poll for new notifications every 10 seconds
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleMarkRead(id, e) {
    if (e) e.stopPropagation();
    try {
      await api.notifications.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      prevUnreadRef.current = Math.max(0, prevUnreadRef.current - 1);
    } catch (err) {
      toast("Failed to mark notification as read", "error");
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.notifications.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
      prevUnreadRef.current = 0;
      toast("All notifications marked as read");
    } catch (err) {
      toast("Failed to mark all as read", "error");
    }
  }

  async function handleClearAll() {
    showConfirm({
      title: "Clear all notifications?",
      message: "Are you sure you want to delete all in-app notifications?",
      danger: true,
      confirmLabel: "Clear All",
      onConfirm: async () => {
        try {
          await api.notifications.clearAll();
          setNotifications([]);
          setUnreadCount(0);
          prevUnreadRef.current = 0;
          toast("Cleared all notifications");
        } catch (err) {
          toast("Failed to clear notifications", "error");
        }
      },
    });
  }

  async function handleDeleteSingle(id, e) {
    if (e) e.stopPropagation();
    try {
      const target = notifications.find((n) => n.id === id);
      await api.notifications.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
        prevUnreadRef.current = Math.max(0, prevUnreadRef.current - 1);
      }
    } catch (err) {
      toast("Failed to delete notification", "error");
    }
  }

  const filteredItems = notifications.filter((n) => {
    if (filter === "unread") return n.is_read === 0;
    return true;
  });

  return (
    <div className="notif-bell-wrapper" ref={drawerRef}>
      <button
        type="button"
        className={`notif-bell-btn ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Notifications (${unreadCount} unread)`}
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-popover">
          <div className="notif-popover__header">
            <div className="notif-popover__title">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Bell size={16} color="var(--teal)" />
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{t("notif.title")}</h4>
              </div>
              {unreadCount > 0 && (
                <span className="badge badge--teal" style={{ fontSize: 11, padding: "2px 8px" }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="notif-popover__actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="btn-icon-subtle"
                  onClick={handleMarkAllRead}
                  title={t("notif.readAll")}
                >
                  <Check size={14} />
                  <span style={{ fontSize: 11 }}>{t("notif.readAll")}</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className="btn-icon-subtle danger"
                  onClick={handleClearAll}
                  title={t("notif.clearAll")}
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={() => setIsOpen(false)}
                title={t("common.close")}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="notif-popover__tabs">
            <button
              className={`notif-tab ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              {t("notif.all")} ({notifications.length})
            </button>
            <button
              className={`notif-tab ${filter === "unread" ? "active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              {t("notif.unread")} ({unreadCount})
            </button>
          </div>

          <div className="notif-popover__list">
            {loading ? (
              <div className="notif-empty">
                <Loader2 size={18} className="spin" color="var(--ink-soft)" />
                <p>{t("common.loading")}</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="notif-empty">
                <Bell size={28} color="var(--ink-faint)" />
                <p style={{ margin: 0, fontWeight: 500, color: "var(--ink-soft)" }}>
                  {t("notif.empty")}
                </p>
                <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {t("reminders.subtitle")}
                </span>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isUnread = item.is_read === 0;
                let notifIcon = <Pill size={16} color="var(--teal)" />;
                let iconBg = "rgba(58, 107, 99, 0.12)";

                if (item.type === "missed") {
                  notifIcon = <AlertTriangle size={16} color="var(--brick)" />;
                  iconBg = "rgba(166, 80, 63, 0.12)";
                } else if (item.type === "system") {
                  notifIcon = <AlarmClock size={16} color="var(--gold)" />;
                  iconBg = "rgba(185, 129, 42, 0.12)";
                }

                return (
                  <div
                    key={item.id}
                    className={`notif-item ${isUnread ? "notif-item--unread" : ""}`}
                    onClick={() => {
                      if (isUnread) handleMarkRead(item.id);
                    }}
                  >
                    <div className="notif-item__icon-wrap" style={{ background: iconBg }}>
                      {notifIcon}
                    </div>

                    <div className="notif-item__body">
                      <div className="notif-item__top">
                        <strong className="notif-item__title">{item.title}</strong>
                        <span className="notif-item__time">{formatRelativeTime(item.created_at)}</span>
                      </div>
                      <p className="notif-item__msg">{item.message}</p>

                      <div className="notif-item__footer">
                        {onNav && (
                          <button
                            type="button"
                            className="notif-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isUnread) handleMarkRead(item.id);
                              onNav("reminders");
                              setIsOpen(false);
                            }}
                          >
                            Go to Reminders <ChevronRight size={12} />
                          </button>
                        )}
                        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                          {isUnread && (
                            <button
                              type="button"
                              className="notif-mini-btn"
                              onClick={(e) => handleMarkRead(item.id, e)}
                              title={t("common.markRead")}
                            >
                              <Check size={12} /> Mark read
                            </button>
                          )}
                          <button
                            type="button"
                            className="notif-mini-btn danger"
                            onClick={(e) => handleDeleteSingle(item.id, e)}
                            title={t("common.deleteNotif")}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isUnread && <span className="notif-unread-dot" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP SHELL
// ---------------------------------------------------------------------------

function Shell({ role, active, onNav, onLogout, title, subtitle, children, userName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useAppLanguage();

  const patientNav = [
    { key: "dashboard", label: t("nav.documents"), icon: Home },
    { key: "reminders", label: t("nav.reminders"), icon: Bell },
    { key: "healthDatabase", label: t("nav.healthLibrary"), icon: HeartPulse },
    { key: "upload", label: t("nav.upload"), icon: UploadCloud },
    { key: "emergency", label: t("nav.emergency"), icon: ShieldAlert },
    { key: "profile", label: t("nav.profile"), icon: User },
  ];
  const workerNav = [
    { key: "dashboard", label: t("nav.patientDirectory"), icon: Users },
    { key: "reminders", label: t("nav.reminders"), icon: Bell },
    { key: "healthDatabase", label: t("nav.healthLibrary"), icon: HeartPulse },
    { key: "upload", label: t("nav.upload"), icon: UploadCloud },
    { key: "emergency", label: t("nav.emergency"), icon: ShieldAlert },
  ];
  const adminNav = [
    { key: "overview", label: t("nav.overview"), icon: LayoutDashboard },
    { key: "users", label: t("nav.users"), icon: UserCog },
    { key: "patients", label: t("nav.patientDirectory"), icon: Users },
    { key: "documents", label: t("nav.documents"), icon: FileText },
    { key: "reminders", label: t("nav.reminders"), icon: Bell },
    { key: "healthDatabase", label: t("nav.healthLibrary"), icon: HeartPulse },
    { key: "emergency", label: t("nav.emergency"), icon: ShieldAlert },
  ];
  const items = role === "patient" ? patientNav : role === "healthcare_worker" ? workerNav : adminNav;

  const initials = userName
    ? userName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : role === "healthcare_worker"
    ? "HW"
    : role === "admin"
    ? "AD"
    : "PT";

  return (
    <div className="app-shell">
      {/* Mobile top navigation header with hamburger menu */}
      <header className="mobile-topbar">
        <button
          type="button"
          className="hamburger-btn"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu size={22} strokeWidth={2.2} />
        </button>
        <div className="mobile-topbar__brand">
          <BrandMark />
        </div>
        <div className="mobile-topbar__actions" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LanguageSelector compact />
          <NotificationBellDrawer onNav={onNav} />
          {userName && (
            <div className="sidebar-avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
              {initials}
            </div>
          )}
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (desktop left column, mobile collapsible drawer) */}
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <BrandMark />
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar__nav">
          {items.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${active === item.key ? "active" : ""}`}
              onClick={() => {
                onNav(item.key);
                setMobileMenuOpen(false);
              }}
            >
              <item.icon size={17} strokeWidth={2} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar__footer">
          {userName && (
            <div className="sidebar-user">
              <div className="sidebar-avatar">{initials}</div>
              <div className="sidebar-user__info">
                <div className="sidebar-user__name" title={userName}>{userName}</div>
                <div className="sidebar-user__role">
                  {role === "healthcare_worker" ? t("role.worker") : role === "admin" ? t("role.admin") : t("role.patient")}
                </div>
              </div>
            </div>
          )}
          <button
            className="nav-item"
            onClick={() => {
              setMobileMenuOpen(false);
              onLogout();
            }}
          >
            <LogOut size={17} strokeWidth={2} />
            {t("nav.logout")}
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="topbar__titles">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <div className="topbar__actions">
            <LanguageSelector />
            <NotificationBellDrawer onNav={onNav} />
            <button
              type="button"
              className="btn btn--secondary mobile-logout-btn"
              onClick={onLogout}
              title={t("nav.logout")}
            >
              <LogOut size={15} strokeWidth={2} />
              <span>{t("nav.logout")}</span>
            </button>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PAGINATION COMPONENT & HOOK
// ---------------------------------------------------------------------------

function Pagination({ currentPage, totalItems, pageSize = 5, onPageChange }) {
  if (!totalItems || totalItems <= pageSize) return null;

  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> items
      </div>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title={t("common.prevPage")}
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            className={`pagination-btn ${p === currentPage ? "pagination-btn--active" : ""}`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="pagination-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title={t("common.nextPage")}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function usePagination(items = [], pageSize = 5) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [items.length, totalPages, currentPage]);

  const paginatedItems = items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
  };
}

// ---------------------------------------------------------------------------
// PATIENT SCREENS
// ---------------------------------------------------------------------------

function PatientDashboard({ patient, onNav, onOpenDocument, onLogout }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { t } = useAppLanguage();

  async function loadDocs() {
    if (!patient?.id) return;
    setLoading(true);
    setError(null);
    try {
      const docs = await api.getPatientDocuments(patient.id);
      setDocuments(docs);
    } catch (err) {
      setError(err.message || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocs();
  }, [patient?.id]);

  function handleDeleteDoc(e, docId) {
    e.stopPropagation();
    showConfirm({
      title: "Delete this document?",
      message: "This will permanently remove the uploaded file and all its extracted medical analysis.",
      danger: true,
      confirmLabel: "Delete Document",
      onConfirm: async () => {
        try {
          await api.deleteDocument(docId);
          setDocuments((prev) => prev.filter((d) => d.id !== docId));
          toast("Document deleted successfully");
        } catch (err) {
          toast("Failed to delete document: " + err.message, "error");
        }
      },
    });
  }

  async function handleDownloadDoc(e, doc) {
    e.stopPropagation();
    try {
      await api.downloadDocumentFile(doc.id, doc.original_filename || "document");
      toast("Download started");
    } catch (err) {
      toast("Download failed: " + err.message, "error");
    }
  }

  const filteredDocs = documents.filter((d) => {
    const q = searchQuery.toLowerCase();
    return !q || (d.original_filename?.toLowerCase().includes(q) || d.document_type?.toLowerCase().includes(q));
  });

  const { currentPage, setCurrentPage, paginatedItems: paginatedDocs } = usePagination(filteredDocs, 5);

  // Derive unique active medications list across documents
  const recentMeds = [];
  documents.forEach((d) => {
    if (d.extraction?.medications && Array.isArray(d.extraction.medications)) {
      d.extraction.medications.forEach((m) => {
        if (m.name && !recentMeds.some((existing) => existing.name?.toLowerCase() === m.name?.toLowerCase())) {
          recentMeds.push(m);
        }
      });
    }
  });

  const patientName = patient?.name ? patient.name.split(" ")[0] : "there";

  return (
    <Shell
      role="patient"
      active="dashboard"
      onNav={onNav}
      onLogout={onLogout}
      userName={patient?.name || t("role.patient")}
      title={t("dashboard.title")}
      subtitle={t("dashboard.subtitle")}
    >
      {error && (
        <div className="alert alert--error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="dashboard-layout-grid">
        {/* Left Column: Documents List & Search */}
        <div className="dashboard-main-content">
          <div className="section">
            <div className="patient-doc-header">
              <h2 style={{ margin: 0, fontSize: "1.15rem", lineHeight: 1.2 }}>{t("dashboard.title")} ({documents.length})</h2>
              <div className="patient-doc-actions">
                {documents.length > 0 && (
                  <div className="search-bar patient-search-bar">
                    <Search size={14} style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder={t("dashboard.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
                <button className="btn btn--secondary" onClick={loadDocs} style={{ height: 34, padding: "0 12px", fontSize: 13, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, boxSizing: "border-box" }}>
                  <RefreshCw size={13} /> {t("common.refresh")}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-box">
                <div className="pulse-ring" />
                <p style={{ color: "var(--ink-soft)", margin: 0 }}>{t("common.loading")}</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="empty-state">
                <FileText size={36} color="var(--ink-faint)" />
                <h3>{searchQuery ? t("common.error") : t("dashboard.noDocsTitle")}</h3>
                <p>{searchQuery ? t("dashboard.searchPlaceholder") : t("dashboard.noDocsSubtitle")}</p>
                <button className="btn btn--primary" onClick={() => onNav("upload")}>
                  <Plus size={16} /> {t("dashboard.uploadNew")}
                </button>
              </div>
            ) : (
              <>
                <div className="doc-card-list">
                  {paginatedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="doc-card"
                      onClick={() => onOpenDocument(doc.id)}
                    >
                      <div className="doc-card__icon">
                        {getDocTypeIcon(doc.document_type)}
                      </div>
                      <div className="doc-card__body">
                        <div className="doc-card__type">{doc.document_type || t("nav.documents")}</div>
                        <div className="doc-card__meta">
                          {doc.original_filename} · {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Recently"}
                        </div>
                      </div>
                      <div className="doc-card__actions">
                        <StatusDot status="ready" />
                        <button
                          className="btn btn--secondary"
                          style={{ padding: "6px 10px", fontSize: 12 }}
                          onClick={(e) => handleDownloadDoc(e, doc)}
                          title={t("dashboard.downloadOriginal")}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="btn btn--secondary"
                          style={{ padding: "6px 10px", fontSize: 12, color: "var(--brick)" }}
                          onClick={(e) => handleDeleteDoc(e, doc.id)}
                          title={t("common.delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredDocs.length}
                  pageSize={5}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>

          {documents.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <button className="btn btn--primary" onClick={() => onNav("upload")}>
                <Plus size={16} /> {t("dashboard.uploadNew")}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Health Summary & Prescription Cheat Sheet */}
        <div className="dashboard-side-panel">
          {/* Active Medications Widget */}
          <div className="side-card">
            <div className="side-card__header">
              <div className="side-card__icon"><Pill size={16} /></div>
              <h3 className="side-card__title">{t("dashboard.prescribedMeds")}</h3>
            </div>
            {recentMeds.length > 0 ? (
              <div className="med-widget-list">
                {recentMeds.slice(0, 5).map((m, idx) => (
                  <div key={idx} className="med-widget-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div className="med-widget-name">{m.name}</div>
                      <div className="med-widget-sub">
                        {m.dosage ? `${t("reminders.dosage")}: ${m.dosage}` : "As prescribed"} {m.frequency ? `· ${m.frequency}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => onNav("reminders", { medicine_name: m.name, dosage: `${m.dosage || ''} ${m.frequency || ''}`.trim() })}
                      style={{ fontSize: 11, padding: "4px 8px" }}
                      title={t("dashboard.scheduleReminder")}
                    >
                      <AlarmClock size={12} /> {t("reminders.scheduleBtn")}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
                {t("dashboard.noDocsSubtitle")}
              </p>
            )}
          </div>

          {/* Quick Health Records Summary */}
          <div className="side-card">
            <div className="side-card__header">
              <div className="side-card__icon"><ClipboardList size={16} /></div>
              <h3 className="side-card__title">{t("nav.overview")}</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--ink-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{t("dashboard.totalRecords")}</span>
                <strong style={{ color: "var(--ink)" }}>{documents.length}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{t("dashboard.preferredLang")}</span>
                <span className="badge badge--teal">{getLanguageName(patient?.preferred_language || "Hindi")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{t("dashboard.lastUpdated")}</span>
                <strong style={{ color: "var(--ink)" }}>
                  {documents[0]?.uploaded_at ? new Date(documents[0].uploaded_at).toLocaleDateString() : t("dashboard.noUploads")}
                </strong>
              </div>
            </div>
          </div>

          {/* Prescription Timings Cheat Sheet */}
          <div className="side-card">
            <div className="side-card__header">
              <div className="side-card__icon"><Sparkles size={16} /></div>
              <h3 className="side-card__title">{t("dashboard.shorthandGuide")}</h3>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 10px 0" }}>
              {t("dashboard.shorthandGuideSub")}
            </p>
            <div className="cheat-sheet-grid">
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">1 - 0 - 1</span>
                <span className="cheat-sheet-desc">{t("dashboard.morningEvening")}</span>
              </div>
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">1 - 1 - 1</span>
                <span className="cheat-sheet-desc">{t("dashboard.thriceDaily")}</span>
              </div>
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">OD / BD</span>
                <span className="cheat-sheet-desc">{t("dashboard.onceTwice")}</span>
              </div>
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">AC / PC</span>
                <span className="cheat-sheet-desc">{t("dashboard.beforeAfter")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// CAMERA CAPTURE MODAL
// ---------------------------------------------------------------------------

function CameraModal({ isOpen, onClose, onCapture }) {
  const { t } = useAppLanguage();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [capturedImg, setCapturedImg] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [currentDeviceId, setCurrentDeviceId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setCapturedImg(null);
    setCameraError(null);

    let activeStream = null;

    async function startCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API is not supported by your current browser environment.");
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevs = allDevices.filter((d) => d.kind === "videoinput");
        setDevices(videoDevs);

        const constraints = {
          video: currentDeviceId
            ? { deviceId: { exact: currentDeviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = stream;
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Camera access error:", err);
        setCameraError(
          err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
            ? "Camera permission was denied. Please allow camera access in your browser settings to take document photos."
            : `Unable to access camera: ${err.message || "Device not found"}.`
        );
      }
    }

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, currentDeviceId]);

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function handleClose() {
    stopStream();
    onClose();
  }

  function switchCamera() {
    if (devices.length < 2) return;
    const currentIndex = devices.findIndex((d) => d.deviceId === currentDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    stopStream();
    setCurrentDeviceId(devices[nextIndex].deviceId);
  }

  function takeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `prescription_${Date.now()}.jpg`, { type: "image/jpeg" });
        const previewUrl = URL.createObjectURL(blob);
        setCapturedImg({ file, previewUrl });
      },
      "image/jpeg",
      0.95
    );
  }

  function handleUsePhoto() {
    if (capturedImg?.file) {
      stopStream();
      onCapture(capturedImg.file, capturedImg.previewUrl);
      onClose();
    }
  }

  function handleRetake() {
    setCapturedImg(null);
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="camera-modal" onClick={(e) => e.stopPropagation()}>
        <div className="camera-header">
          <h3 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Camera size={18} color="var(--teal)" />
            {t("upload.useCamera")}
          </h3>
          <button
            onClick={handleClose}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
            title={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="camera-viewfinder">
          {cameraError ? (
            <div style={{ padding: 24, textAlign: "center", color: "#FDF2F0" }}>
              <AlertCircle size={36} style={{ marginBottom: 12, color: "var(--brick)" }} />
              <p style={{ margin: "0 0 14px", fontSize: 14 }}>{cameraError}</p>
              <button
                className="btn btn--secondary"
                onClick={handleClose}
                style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
              >
                {t("common.close")}
              </button>
            </div>
          ) : capturedImg ? (
            <img src={capturedImg.previewUrl} alt="Captured prescription" className="camera-preview-img" />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              <div className="camera-guide-overlay">
                <span className="camera-guide-text">{t("upload.cameraFrameInstruction")}</span>
                <span className="camera-guide-text">{t("upload.cameraSteadyInstruction")}</span>
              </div>
            </>
          )}
        </div>

        <div className="camera-controls">
          {capturedImg ? (
            <>
              <button type="button" className="camera-tool-btn" onClick={handleRetake}>
                <RefreshCw size={15} /> {t("common.refresh")}
              </button>
              <button type="button" className="btn btn--primary" onClick={handleUsePhoto}>
                <Check size={16} /> {t("common.save")}
              </button>
            </>
          ) : (
            <>
              {devices.length > 1 ? (
                <button type="button" className="camera-tool-btn" onClick={switchCamera}>
                  <RefreshCw size={15} /> {t("common.refresh")}
                </button>
              ) : (
                <div style={{ width: 80 }} />
              )}

              {!cameraError && (
                <button
                  type="button"
                  className="shutter-btn"
                  onClick={takeSnapshot}
                  title={t("upload.takePhotoButton")}
                >
                  <Camera size={26} />
                </button>
              )}

              <button type="button" className="camera-tool-btn" onClick={handleClose}>
                {t("common.cancel")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DOCUMENT UPLOAD SCREEN
// ---------------------------------------------------------------------------

function UploadScreen({ role, currentPatient, onNav, onUploaded, onLogout }) {
  const { t } = useAppLanguage();
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [targetLang, setTargetLang] = useState(
    currentPatient?.preferred_language ? getLanguageCode(currentPatient.preferred_language) : "hi"
  );
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(currentPatient?.id || "");
  const [loading, setLoading] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [error, setError] = useState(null);

  const UPLOAD_STEPS = [
    { label: "Uploading document to server" },
    { label: "Running OCR & extracting text" },
    { label: "Analyzing medications with AI pipeline" },
    { label: "Generating plain language summary & translation" },
  ];

  useEffect(() => {
    if (role === "healthcare_worker") {
      api.getPatients()
        .then((pts) => {
          setPatients(pts);
          if (!selectedPatientId && pts.length > 0) {
            setSelectedPatientId(pts[0].id);
          }
        })
        .catch((err) => console.error("Could not load patients list", err));
    }
  }, [role]);

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setFileName(selected.name);
      if (selected.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(selected));
      } else {
        setPreviewUrl(null);
      }
      setError(null);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      setFileName(dropped.name);
      if (dropped.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(dropped));
      } else {
        setPreviewUrl(null);
      }
      setError(null);
    }
  }

  function handleCameraCapture(capturedFile, capturedPreviewUrl) {
    setFile(capturedFile);
    setFileName(capturedFile.name);
    setPreviewUrl(capturedPreviewUrl);
    setError(null);
  }

  function handleClearFile() {
    setFile(null);
    setFileName("");
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError("Please take a photo or choose a document file to upload.");
      return;
    }

    setLoading(true);
    setError(null);
    setActiveStepIndex(0);

    const stageTimer1 = setTimeout(() => setActiveStepIndex(1), 2000);
    const stageTimer2 = setTimeout(() => setActiveStepIndex(2), 5000);
    const stageTimer3 = setTimeout(() => setActiveStepIndex(3), 8500);

    try {
      const patientIdToAttach = role === "healthcare_worker" ? (selectedPatientId || undefined) : undefined;
      const result = await api.uploadDocument({
        file,
        patientId: patientIdToAttach,
        targetLanguage: targetLang,
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);

      toast("Document processed successfully!");
      onUploaded(result.document_id);
    } catch (err) {
      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);
      setError(err.message || "Document processing failed. Please try again.");
      toast(err.message || "Document processing failed", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Shell
      role={role}
      active="upload"
      onNav={onNav}
      onLogout={onLogout}
      title={role === "patient" ? t("upload.title") : t("nav.upload")}
      subtitle={role === "patient" ? t("upload.subtitle") : t("upload.subtitle")}
    >
      {error && (
        <div className="alert alert--error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="upload-layout-grid">
        <div className="upload-main-form">
          {role === "healthcare_worker" && (
            <div className="section">
              <h2>{t("upload.patientAssignment")}</h2>
              <Field label={t("upload.selectPatient")} hint={t("upload.selectPatientHint")}>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  <option value="">-- Create new patient record --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || "Unnamed"} {p.phone_number ? `(${p.phone_number})` : ""} — ID: {p.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          <form onSubmit={handleUpload}>
            <div className="section">
              <h2>{t("upload.docSource")}</h2>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />

              {!file ? (
                <div
                  className={`upload-drop-zone ${isDragging ? "upload-drop-zone--active" : ""}`}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="upload-drop-icon">
                    <UploadCloud size={44} strokeWidth={1.75} />
                  </div>
                  <h3 style={{ margin: "0 0 6px", fontSize: 16, color: "var(--ink)" }}>
                    {isDragging ? t("upload.dropzone") : t("upload.dropzone")}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
                    {t("upload.supported")}
                  </p>
                  <div className="upload-drop-zone__actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud size={15} /> {t("upload.chooseFile")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => setIsCameraOpen(true)}
                    >
                      <Camera size={15} /> {t("upload.useCamera")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="selected-file-card">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Document preview" />
                  ) : (
                    <div style={{ width: 54, height: 54, background: "var(--paper-deep)", borderRadius: "var(--radius-s)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--teal)" }}>
                      <FileText size={28} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {fileName}
                    </strong>
                    <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                      {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Document ready for processing"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={handleClearFile}
                    style={{ padding: "6px 12px", fontSize: 12 }}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              )}

              <Field label={t("upload.targetLang")} hint={t("upload.targetLangHint")}>
                <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {loading ? (
              <div className="upload-stepper">
                <div className="upload-stepper__title">{t("upload.processingTitle")}</div>
                <div className="stepper-steps">
                  {UPLOAD_STEPS.map((step, idx) => {
                    const isDone = idx < activeStepIndex;
                    const isActive = idx === activeStepIndex;
                    return (
                      <div
                        key={idx}
                        className={`stepper-step ${isDone ? "stepper-step--done" : ""} ${isActive ? "stepper-step--active" : ""}`}
                      >
                        <div className="stepper-dot">
                          {isDone ? <Check size={12} strokeWidth={3} /> : idx + 1}
                        </div>
                        <span>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 8 }}>
                  This takes about 10-15 seconds for OCR extraction, Groq medication structuring, simplification, and translation.
                </span>
              </div>
            ) : (
              <button type="submit" className="btn btn--primary" disabled={!file}>
                <UploadCloud size={16} /> {t("upload.processBtn")}
              </button>
            )}
          </form>
        </div>

        {/* Right Side Panel: Tips or Live Document Inspection */}
        <div className="upload-side-panel">
          {!file ? (
            <div className="side-card">
              <div className="side-card__header">
                <div className="side-card__icon"><Sparkles size={16} /></div>
                <h3 className="side-card__title">{t("upload.guideTitle")}</h3>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
                Follow these tips to get the highest OCR accuracy for doctor prescriptions and lab reports:
              </p>
              <div className="guide-tips-list">
                <div className="guide-tip-item">
                  <Camera size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>{t("upload.guidePoint1Title")}</strong>
                    <p style={{ margin: "2px 0 0" }}>{t("upload.guidePoint1Text")}</p>
                  </div>
                </div>
                <div className="guide-tip-item">
                  <FileText size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>{t("upload.guidePoint2Title")}</strong>
                    <p style={{ margin: "2px 0 0" }}>{t("upload.guidePoint2Text")}</p>
                  </div>
                </div>
                <div className="guide-tip-item">
                  <ShieldCheck size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>100% Private & Encrypted</strong>
                    <p style={{ margin: "2px 0 0" }}>{t("upload.guidePoint3Text")}</p>
                  </div>
                </div>
                <div className="guide-tip-item">
                  <Globe size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>{t("upload.instantTranslation")}</strong>
                    <p style={{ margin: "2px 0 0" }}>Explanations are simplified and translated into 10+ local languages.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-card">
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel)" }}>
                <h3 className="side-card__title" style={{ fontSize: 14 }}>{t("upload.livePreview")}</h3>
                <span className="badge badge--teal">{t("common.ready")}</span>
              </div>
              <div className="preview-card__image-box">
                {previewUrl ? (
                  <img src={previewUrl} alt="Selected document live preview" />
                ) : (
                  <div style={{ textAlign: "center", padding: 32, color: "var(--ink-soft)" }}>
                    <FileText size={48} color="var(--teal)" style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{t("upload.pdfSelected")}</p>
                    <span style={{ fontSize: 12 }}>{fileName}</span>
                  </div>
                )}
              </div>
              <div className="preview-card__details">
                <div className="preview-card__meta-row">
                  <span>{t("upload.fileName")}</span>
                  <strong style={{ color: "var(--ink)" }}>{fileName}</strong>
                </div>
                <div className="preview-card__meta-row">
                  <span>{t("upload.fileSize")}</span>
                  <span>{file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—"}</span>
                </div>
                <div className="preview-card__meta-row">
                  <span>{t("profile.targetLang")}:</span>
                  <span className="badge badge--teal">{getLanguageName(targetLang)}</span>
                </div>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={handleClearFile}
                  style={{ width: "100%", marginTop: 8, fontSize: 13 }}
                >
                  Clear / Select different file
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Camera Viewfinder Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </Shell>
  );
}


// ---------------------------------------------------------------------------
// TTS HELPERS & PLAYER
// ---------------------------------------------------------------------------

/**
 * Converts the structured extraction object into a natural-language script
 * that can be fed directly to the Web Speech API — no JSON, no brackets.
 */
function buildTTSScript(extraction) {
  const parts = [];

  if (extraction.simplified_explanation) {
    parts.push("Here is your document summary. " + extraction.simplified_explanation);
  }

  if (extraction.translated_explanation) {
    const langName = getLanguageName(extraction.language);
    parts.push(`Translated in ${langName}. ` + extraction.translated_explanation);
  }

  const medications = extraction.medications || [];
  if (medications.length > 0) {
    const medLines = medications.map((m, i) => {
      const num = i + 1;
      const name = m.name || "Unknown medicine";
      const dosage = m.dosage ? `, ${m.dosage}` : "";
      const freq = m.frequency ? `, ${m.frequency}` : "";
      const duration = m.duration ? ` for ${m.duration}` : "";
      const instruction = m.instruction ? `. ${m.instruction}` : ".";
      return `${num}. ${name}${dosage}${freq}${duration}${instruction}`;
    });
    parts.push("Your medications. " + medLines.join(" "));
  }

  return parts.join("  "); // double-space gives natural pause between sections
}

/** BCP-47 language code map for matching voices */
const LANG_BCP47 = {
  hi: "hi",
  en: "en",
  bn: "bn",
  ta: "ta",
  te: "te",
  mr: "mr",
  gu: "gu",
  kn: "kn",
  pa: "pa",
  ur: "ur",
};

function TTSPlayer({ extraction }) {
  const { t } = useAppLanguage();
  const [status, setStatus] = useState("idle"); // "idle", "playing", "paused"
  const [rate, setRate] = useState(1);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const utteranceRef = useRef(null);

  // Load voices — they load async in most browsers
  useEffect(() => {
    function loadVoices() {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
        // Auto-select best matching voice for document language
        const langCode = getLanguageCode(extraction?.language);
        const bcp = LANG_BCP47[langCode] || "en";
        const best =
          available.find((v) => v.lang.toLowerCase().startsWith(bcp)) ||
          available.find((v) => v.lang.toLowerCase().startsWith("en")) ||
          available[0];
        setSelectedVoice(best?.voiceURI || null);
      }
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, [extraction?.language]);

  // Cancel on unmount
  useEffect(() => () => window.speechSynthesis.cancel(), []);

  const script = buildTTSScript(extraction || {});

  function handlePlay() {
    if (status === "paused") {
      window.speechSynthesis.resume();
      setStatus("playing");
      return;
    }
    // Start fresh
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(script);
    utter.rate = rate;
    const voice = voices.find((v) => v.voiceURI === selectedVoice);
    if (voice) utter.voice = voice;
    utter.onstart = () => setStatus("playing");
    utter.onpause = () => setStatus("paused");
    utter.onresume = () => setStatus("playing");
    utter.onend = () => setStatus("idle");
    utter.onerror = () => setStatus("idle");
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }

  function handlePause() {
    window.speechSynthesis.pause();
    setStatus("paused");
  }

  function handleStop() {
    window.speechSynthesis.cancel();
    setStatus("idle");
  }

  const isPlaying = status === "playing";
  const isPaused = status === "paused";
  const isActive = isPlaying || isPaused;

  return (
    <div className="tts-player">
      <div className="tts-player__header">
        <div className="tts-player__title">
          <Volume2 size={16} color="var(--teal)" />
          <span>{t("landing.audioAssistanceTitle")}</span>
          {isPlaying && (
            <div className="tts-waveform">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="tts-bar" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
          {isPaused && <span className="tts-status-badge">{t("reminders.snoozed")}</span>}
        </div>

        <div className="tts-player__controls">
          <button
            className="tts-btn tts-btn--stop"
            onClick={handleStop}
            disabled={!isActive}
            title={t("audio.stop")}
          >
            <Square size={13} fill={isActive ? "currentColor" : "none"} />
          </button>

          {isPlaying ? (
            <button className="tts-btn tts-btn--main" onClick={handlePause} title={t("audio.pause")}>
              <Pause size={16} fill="currentColor" /> Pause
            </button>
          ) : (
            <button className="tts-btn tts-btn--main tts-btn--play" onClick={handlePlay} title={isPaused ? "Resume" : "Play"}>
              <Play size={16} fill="currentColor" /> {isPaused ? "Resume" : "Play"}
            </button>
          )}
        </div>
      </div>

      <div className="tts-player__settings">
        <div className="tts-setting">
          <label htmlFor="tts-voice-select">{t("common.language")}</label>
          <select
            id="tts-voice-select"
            value={selectedVoice || ""}
            onChange={(e) => {
              setSelectedVoice(e.target.value);
              if (isActive) handleStop();
            }}
          >
            {voices.length === 0 && <option value="">{t("common.loading")}</option>}
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>

        <div className="tts-setting">
          <label htmlFor="tts-rate">Speed: {rate}×</label>
          <input
            id="tts-rate"
            type="range"
            min="0.5"
            max="2"
            step="0.25"
            value={rate}
            onChange={(e) => {
              setRate(parseFloat(e.target.value));
              if (isActive) handleStop();
            }}
          />
        </div>
      </div>

      <details className="tts-script-preview">
        <summary>{t("audio.previewScript")}</summary>
        <p>{script || "No content available to speak."}</p>
      </details>
    </div>
  );
}


// ---------------------------------------------------------------------------
// AI CHATBOT COMPONENT
// ---------------------------------------------------------------------------

function AIChatBot({ documentId, initialLanguage = "hi" }) {
  const { t } = useAppLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Namaste! I am your Sehat Saathi AI Health Assistant. Ask me anything about your medications, dosages, side effects, or general health concerns in English or your preferred regional language.",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState(initialLanguage);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState(null);
  const [voices, setVoices] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);
  const autoSpeakNextRef = useRef(false);

  // Load voices for Web Speech API
  useEffect(() => {
    function loadVoices() {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    }
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  // Stop TTS if language changes or component unmounts
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
      setSpeakingMsgIdx(null);
    };
  }, [language]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, sending, transcribing, isOpen]);

  function speakMessage(text, idx) {
    if (!window.speechSynthesis) {
      toast("Text-to-speech is not supported in this browser", "error");
      return;
    }

    if (speakingMsgIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingMsgIdx(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean text from markdown symbols for natural narration
    const cleanText = text
      .replace(/[*_#`~]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    const utter = new SpeechSynthesisUtterance(cleanText);

    // Auto-select best voice matching the current language selection
    const langCode = getLanguageCode(language);
    const bcp = LANG_BCP47[langCode] || "en";
    const available = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
    const bestVoice =
      available.find((v) => v.lang.toLowerCase().startsWith(bcp)) ||
      available.find((v) => v.lang.toLowerCase().startsWith("en")) ||
      available[0];

    if (bestVoice) {
      utter.voice = bestVoice;
      utter.lang = bestVoice.lang;
    }

    const storedRate = parseFloat(localStorage.getItem("sehat_saathi_speech_rate") || "1.0");
    utter.rate = isNaN(storedRate) ? 1.0 : storedRate;

    utter.onstart = () => setSpeakingMsgIdx(idx);
    utter.onend = () => setSpeakingMsgIdx(null);
    utter.onerror = () => setSpeakingMsgIdx(null);

    setSpeakingMsgIdx(idx);
    window.speechSynthesis.speak(utter);
  }

  async function handleSend(textToSend, isVoiceInput = false) {
    const query = (textToSend || input).trim();
    if (!query || sending) return;

    if (isVoiceInput) {
      autoSpeakNextRef.current = true;
    }

    const userMsg = {
      sender: "user",
      text: query,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await api.chat(query, documentId, language);
      const responseText = res.response || "I couldn't process your question right now.";
      const botMsg = {
        sender: "bot",
        text: responseText,
        source: res.source || "ai_generated",
        medlineplusTopic: res.medlineplus_topic || null,
        aiGenerated: res.ai_generated ?? true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => {
        const updated = [...prev, botMsg];
        const newBotIdx = updated.length - 1;

        if (autoSpeakNextRef.current) {
          autoSpeakNextRef.current = false;
          setTimeout(() => {
            speakMessage(responseText, newBotIdx);
          }, 150);
        }
        return updated;
      });
    } catch (err) {
      toast("Chat error: " + (err.message || "Failed to fetch response"), "error");
      const errorMsg = {
        sender: "bot",
        text: "Sorry, I encountered an error answering your query. Please try again.",
        source: "ai_generated",
        aiGenerated: true,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        setTranscribing(true);
        try {
          const res = await api.speechToText(audioBlob, language);
          if (res.text) {
            toast("Speech transcribed! Auto-sending query...");
            await handleSend(res.text, true);
          } else {
            toast("Could not recognize speech", "error");
          }
        } catch (err) {
          toast("Speech-to-text error: " + err.message, "error");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
      toast("Recording started... Speak now");
    } catch (err) {
      toast("Microphone access error: " + err.message, "error");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  function toggleRecording() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  const chatMarkup = !isOpen ? (
    <div className="chatbot-floating-launcher">
      <button
        type="button"
        className="chatbot-fab-btn"
        onClick={() => setIsOpen(true)}
        title={t("assistant.title")}
      >
        <div className="chatbot-fab-icon">
          <Bot size={22} color="#ffffff" />
        </div>
        <span className="chatbot-fab-label">{t("assistant.title")}</span>
        {messages.length > 1 && (
          <span className="chatbot-fab-badge">{messages.length - 1}</span>
        )}
      </button>
    </div>
  ) : (
    <div className="chatbot-floating-window">
      <div className="chatbot-header">
        <div className="chatbot-title">
          <div className="bot-avatar-badge">
            <Bot size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t("assistant.titleShort")}</h3>
            <p style={{ margin: 0, fontSize: 11, color: "var(--ink-soft)" }}>
              AI Health Assistant
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="chatbot-lang-select">
            <Globe size={13} color="var(--ink-soft)" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ fontSize: 11, padding: "2px 4px", borderRadius: 4, background: "transparent", border: "none", color: "var(--ink)", outline: "none" }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="chatbot-close-btn"
            onClick={() => setIsOpen(false)}
            title={t("assistant.minimize")}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="chatbot-messages">
        {messages.map((m, idx) => (
          <div key={idx} className={`chat-bubble-wrap ${m.sender === "user" ? "chat-bubble-user" : "chat-bubble-bot"}`}>
            {m.sender === "bot" && (
              <div className="chat-avatar">
                <Bot size={14} />
              </div>
            )}
            <div className="chat-bubble">
              {m.sender === "bot" && (
                <div style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  {m.source === "medlineplus" ? (
                    <span className="badge badge--teal" style={{ fontSize: 10, padding: "2px 6px" }}>
                      <ShieldCheck size={10} style={{ marginRight: 3, verticalAlign: "middle" }} /> MedlinePlus Database
                    </span>
                  ) : (
                    <span className="badge badge--paper" style={{ fontSize: 10, padding: "2px 6px", color: "var(--ink-soft)" }}>
                      <Sparkles size={10} style={{ marginRight: 3, verticalAlign: "middle" }} /> AI Generated Response
                    </span>
                  )}
                  {m.medlineplusTopic?.url && (
                    <a
                      href={m.medlineplusTopic.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 10, color: "var(--teal)", textDecoration: "underline" }}
                    >
                      View MedlinePlus topic
                    </a>
                  )}
                </div>
              )}
              <div className="chat-text">{m.text}</div>
              <div className="chat-meta">
                <span>{m.time}</span>
                {m.sender === "bot" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      className={`copy-btn ${speakingMsgIdx === idx ? "copy-btn--speaking" : ""}`}
                      onClick={() => speakMessage(m.text, idx)}
                      title={speakingMsgIdx === idx ? "Stop Listening" : "Listen to response"}
                    >
                      {speakingMsgIdx === idx ? (
                        <>
                          <VolumeX size={13} strokeWidth={2} />
                          <span>{t("audio.stop")}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={13} strokeWidth={2} />
                          <span>{t("audio.listen")}</span>
                        </>
                      )}
                    </button>
                    <CopyButton text={m.text} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {sending && (
          <div className="chat-bubble-wrap chat-bubble-bot">
            <div className="chat-avatar">
              <Bot size={14} />
            </div>
            <div className="chat-bubble chat-bubble-typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </div>
        )}

        {transcribing && (
          <div className="chat-bubble-wrap chat-bubble-user">
            <div className="chat-bubble chat-bubble-transcribing">
              <Loader2 size={14} className="spin" /> Transcribing speech audio & auto-sending...
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <form
        className="chatbot-input-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <button
          type="button"
          className={`mic-btn ${recording ? "mic-btn--recording" : ""}`}
          onClick={toggleRecording}
          disabled={sending || transcribing}
          title={recording ? "Stop Recording & Auto Send" : "Speak your query (Voice Input)"}
        >
          {recording ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <input
          type="text"
          placeholder={recording ? "Listening... Speak now!" : "Type or speak your question..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending || recording || transcribing}
        />

        <button
          type="submit"
          className="btn btn--primary send-chat-btn"
          disabled={!input.trim() || sending || recording || transcribing}
        >
          {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );

  return createPortal(chatMarkup, document.body);
}

// ---------------------------------------------------------------------------
// DOCUMENT DETAIL SCREEN
// ---------------------------------------------------------------------------

function DocumentDetailScreen({ role, documentId, onNav, onBack, onLogout }) {
  const { t } = useAppLanguage();
  const [docRecord, setDocRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadDoc() {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getDocument(documentId);
      setDocRecord(data);
    } catch (err) {
      setError(err.message || "Failed to load document details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDoc();
  }, [documentId]);

  async function handleDownload() {
    try {
      await api.downloadDocumentFile(documentId, docRecord?.original_filename || "medical_document");
      toast("Download started");
    } catch (err) {
      toast("Failed to download file: " + err.message, "error");
    }
  }

  function handleDelete() {
    showConfirm({
      title: "Delete this document?",
      message: "Are you sure you want to delete this document and all its extraction data? This action cannot be undone.",
      danger: true,
      confirmLabel: "Delete Document",
      onConfirm: async () => {
        try {
          await api.deleteDocument(documentId);
          toast("Document deleted successfully");
          onBack();
        } catch (err) {
          toast("Failed to delete document: " + err.message, "error");
        }
      },
    });
  }

  const extraction = docRecord?.extraction || {};
  const medications = extraction.medications || [];
  const { currentPage: medPage, setCurrentPage: setMedPage, paginatedItems: paginatedMedications } = usePagination(medications, 5);

  return (
    <Shell
      role={role}
      active="dashboard"
      onNav={onNav}
      onLogout={onLogout}
      title={extraction.document_type || docRecord?.original_filename || t("docDetail.docDetails")}
      subtitle={
        docRecord
          ? `Uploaded ${new Date(docRecord.uploaded_at).toLocaleString()} · Language: ${getLanguageName(extraction.language)}`
          : "Analyzing document..."
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button className="back-link" onClick={onBack} style={{ margin: 0 }}>
          <ArrowLeft size={15} /> {t("common.back")}
        </button>
      </div>

      {error && (
        <div className="alert alert--error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-box">
          <div className="pulse-ring" />
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>{t("common.loading")}</p>
        </div>
      ) : (
        <div className="doc-detail-layout-grid">
          {/* MAIN COLUMN (LEFT) */}
          <div className="doc-detail-main">
            {/* TTS Player */}
            <TTSPlayer extraction={extraction} />

            {/* EXTRACTED PRESCRIBED MEDICATIONS SECTION */}
            {medications.length > 0 && (
              <div className="section" style={{ marginTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 18, color: "var(--ink)" }}>
                    <Pill size={20} color="var(--teal)" /> {t("dashboard.prescribedMeds")} ({medications.length})
                  </h2>
                  <span className="badge badge--teal" style={{ fontSize: 11 }}>{t("docDetail.structuredExtraction")}</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {paginatedMedications.map((med, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "var(--panel)",
                        border: "1px solid var(--border-soft)",
                        borderRadius: 12,
                        padding: "16px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                          <h4 style={{ margin: 0, fontSize: 16, color: "var(--ink)", fontWeight: 700 }}>{med.name || "Unknown Medicine"}</h4>
                          {med.dosage && <span className="badge badge--gold" style={{ fontSize: 11 }}>{med.dosage}</span>}
                        </div>

                        <div style={{ fontSize: 13, color: "var(--ink-soft)", display: "flex", gap: 16, flexWrap: "wrap", marginTop: 4 }}>
                          {med.frequency && <span><strong>{t("docDetail.frequency")}</strong> {med.frequency}</span>}
                          {med.duration && <span><strong>{t("docDetail.duration")}</strong> {med.duration}</span>}
                        </div>

                        {med.instruction && (
                          <div style={{ fontSize: 12, color: "var(--teal)", marginTop: 6, fontStyle: "italic" }}>
                            💡 {med.instruction}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => onNav("reminders", { medicine_name: med.name, dosage: `${med.dosage || ''} ${med.frequency || ''}`.trim(), document_id: documentId })}
                        style={{ fontSize: 12 }}
                      >
                        <AlarmClock size={14} /> Set Reminder
                      </button>
                    </div>
                  ))}
                </div>

                {medications.length > 5 && (
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                    <Pagination
                      currentPage={medPage}
                      totalItems={medications.length}
                      pageSize={5}
                      onPageChange={setMedPage}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="section" style={{ marginTop: 24 }}>
              <h2>{t("docDetail.plainLanguage")}</h2>
              {extraction.simplified_explanation && (
                <div className="explanation-block">
                  <div className="explanation-block__header">
                    <span className="lang-tag badge badge--teal">{t("docDetail.englishSimplified")}</span>
                    <CopyButton text={extraction.simplified_explanation} />
                  </div>
                  <p style={{ margin: 0 }}>{extraction.simplified_explanation}</p>
                </div>
              )}
              {extraction.translated_explanation && (
                <div className="explanation-block">
                  <div className="explanation-block__header">
                    <span className="lang-tag badge badge--gold">
                      {getLanguageName(extraction.language)} (Translated)
                    </span>
                    <CopyButton text={extraction.translated_explanation} />
                  </div>
                  <p style={{ margin: 0 }}>{extraction.translated_explanation}</p>
                </div>
              )}
            </div>

            {extraction.raw_text && (
              <div className="section" style={{ border: "none" }}>
                <details className="raw-text">
                  <summary>{t("docDetail.showRawOCR")}</summary>
                  <pre>{extraction.raw_text}</pre>
                </details>
              </div>
            )}

            {/* AI MEDICAL CHATBOT WIDGET */}
            <AIChatBot documentId={documentId} initialLanguage={extraction.language || "hi"} />
          </div>

          {/* SIDE PANEL (RIGHT) */}
          <div className="doc-detail-side-panel">
            {/* Overview & Quick Actions Card */}
            <div className="side-card">
              <div className="side-card__header">
                <FileText size={18} color="var(--teal)" />
                <h3 className="side-card__title">{t("docDetail.docDetails")}</h3>
              </div>

              <div className="doc-meta-list">
                <div className="doc-meta-item">
                  <span className="doc-meta-label">{t("docDetail.type")}</span>
                  <span className="badge badge--teal" style={{ textTransform: "capitalize" }}>
                    {(extraction.document_type || "prescription").replace("_", " ")}
                  </span>
                </div>
                <div className="doc-meta-item">
                  <span className="doc-meta-label">{t("profile.targetLang")}:</span>
                  <span className="badge badge--gold">{getLanguageName(extraction.language)}</span>
                </div>
                <div className="doc-meta-item">
                  <span className="doc-meta-label">{t("docDetail.uploaded")}</span>
                  <span style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500 }}>
                    {docRecord ? new Date(docRecord.uploaded_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className="doc-meta-item">
                  <span className="doc-meta-label">{t("upload.fileName")}</span>
                  <span style={{ fontSize: "12.5px", color: "var(--ink-soft)", wordBreak: "break-all" }}>
                    {docRecord?.original_filename || "medical_record"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
                <button className="btn btn--secondary" onClick={handleDownload} style={{ width: "100%", justifyContent: "center" }}>
                  <Download size={15} /> Download original file
                </button>
                <button className="btn btn--secondary" onClick={handleDelete} style={{ width: "100%", justifyContent: "center", color: "var(--brick)", borderColor: "rgba(192, 57, 43, 0.3)" }}>
                  <Trash2 size={15} /> Delete document
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// PATIENT PROFILE SCREEN
// ---------------------------------------------------------------------------

function ProfileScreen({ user, patient, onNav, onLogout, onProfileUpdated }) {
  const { t } = useAppLanguage();
  const [name, setName] = useState(patient?.name || "");
  const [age, setAge] = useState(patient?.age || "");
  const [gender, setGender] = useState(patient?.gender || "Female");
  const [phone, setPhone] = useState(patient?.phone_number || "");
  const [preferredLang, setPreferredLang] = useState(patient?.preferred_language || "Hindi");
  const [bloodGroup, setBloodGroup] = useState(patient?.blood_group || "");
  const [emergencyContact, setEmergencyContact] = useState(patient?.emergency_contact || "");
  const [allergies, setAllergies] = useState(patient?.allergies || "");
  const [medicalConditions, setMedicalConditions] = useState(patient?.medical_conditions || "");
  const [narrationSpeed, setNarrationSpeed] = useState(() => {
    return localStorage.getItem("sehat_saathi_speech_rate") || "1.0";
  });

  const [docCount, setDocCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  useEffect(() => {
    if (patient) {
      setName(patient.name || "");
      setAge(patient.age || "");
      setGender(patient.gender || "Female");
      setPhone(patient.phone_number || "");
      setPreferredLang(patient.preferred_language || "Hindi");
      setBloodGroup(patient.blood_group || "");
      setEmergencyContact(patient.emergency_contact || "");
      setAllergies(patient.allergies || "");
      setMedicalConditions(patient.medical_conditions || "");
    }
  }, [patient]);

  useEffect(() => {
    if (patient?.id) {
      api.getPatientDocuments(patient.id)
        .then((docs) => setDocCount(docs.length))
        .catch(() => setDocCount(0));
    }
  }, [patient?.id]);

  function getInitials(str) {
    if (!str) return "P";
    const parts = str.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return str.slice(0, 2).toUpperCase();
  }

  // Profile completion calculation
  const completionFields = [
    { name: "Full name", filled: Boolean(name) },
    { name: "Age", filled: Boolean(age) },
    { name: "Gender", filled: Boolean(gender) },
    { name: "Phone number", filled: Boolean(phone) },
    { name: "Preferred language", filled: Boolean(preferredLang) },
    { name: "Blood group", filled: Boolean(bloodGroup) },
    { name: "Emergency contact", filled: Boolean(emergencyContact) },
    { name: "Allergies & medical notes", filled: Boolean(allergies || medicalConditions) },
  ];
  const filledCount = completionFields.filter(f => f.filled).length;
  const completionScore = Math.round((filledCount / completionFields.length) * 100);
  const firstMissing = completionFields.find(f => !f.filled);

  function handleCopyId() {
    if (patient?.id) {
      navigator.clipboard.writeText(patient.id);
      setCopiedId(true);
      toast("Patient ID copied to clipboard!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  function handleCopyEmergencyPass() {
    const passText = `=== SEHAT SAATHI EMERGENCY PATIENT PASS ===
Name: ${name || 'N/A'}
Patient ID: ${patient?.id || 'N/A'}
Age / Gender: ${age ? age + ' yrs' : 'N/A'} / ${gender || 'N/A'}
{t("profile.bloodGroup")}: ${bloodGroup || 'Unspecified'}
Emergency Contact: ${emergencyContact || 'Not provided'}
Known Allergies: ${allergies || 'None listed'}
Medical Conditions: ${medicalConditions || 'None listed'}
{t("dashboard.preferredLang")} ${preferredLang || 'Hindi'}
===========================================`;
    navigator.clipboard.writeText(passText);
    setCopiedPass(true);
    toast("Emergency Pass summary copied to clipboard!");
    setTimeout(() => setCopiedPass(false), 2500);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!patient?.id) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      localStorage.setItem("sehat_saathi_speech_rate", narrationSpeed);
      const updated = await api.updatePatient(patient.id, {
        name,
        age: age ? parseInt(age, 10) : null,
        gender,
        phone_number: phone,
        preferred_language: preferredLang,
        blood_group: bloodGroup,
        emergency_contact: emergencyContact,
        allergies: allergies,
        medical_conditions: medicalConditions,
      });
      setSuccess(true);
      toast("Profile updated successfully!");
      if (onProfileUpdated) onProfileUpdated(updated);
    } catch (err) {
      setError(err.message || "Failed to update profile.");
      toast(err.message || "Failed to update profile", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteAccount() {
    showConfirm({
      title: "Delete your account?",
      message: "Warning: Deleting your profile will permanently delete all your uploaded documents and remove your account. This action cannot be undone.",
      danger: true,
      confirmLabel: "Delete Account",
      onConfirm: async () => {
        try {
          await api.deletePatient(patient.id);
          toast("Account deleted");
          api.logout();
          onLogout();
        } catch (err) {
          toast("Failed to delete account: " + err.message, "error");
        }
      },
    });
  }

  return (
    <Shell
      role="patient"
      active="profile"
      onNav={onNav}
      onLogout={onLogout}
      userName={patient?.name}
      title={t("nav.profile")}
      subtitle={t("landing.heroSubtitle") ? undefined : "Manage your personal details, emergency medical baseline, and app preferences."}
    >
      <div className="profile-wrapper">
        {success && (
          <div className="alert alert--success" style={{ marginBottom: 20 }}>
            <CheckCircle2 size={18} />
            <span>{t("profile.savedSuccess")}</span>
          </div>
        )}

        {error && (
          <div className="alert alert--error" style={{ marginBottom: 20 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* HERO BANNER CARD */}
        <div className="profile-hero-card">
          <div className="profile-hero-main">
            <div className="profile-avatar-circle">
              {getInitials(name || user?.name || "Patient")}
            </div>
            <div className="profile-hero-info">
              <div className="profile-hero-name-row">
                <h2 className="profile-hero-name">{name || "Patient Profile"}</h2>
                <span className="profile-badge profile-badge--verified">
                  <BadgeCheck size={14} /> Registered Patient
                </span>
              </div>
              <div className="profile-hero-meta">
                <span className="profile-id-tag">
                  ID: <code>{patient?.id || "N/A"}</code>
                  <button
                    type="button"
                    className="btn-icon-subtle"
                    onClick={handleCopyId}
                    title={t("profile.copyId")}
                  >
                    {copiedId ? <Check size={13} style={{ color: "var(--teal)" }} /> : <Copy size={13} />}
                  </button>
                </span>
                {user?.email && (
                  <span className="profile-meta-item">
                    ✉️ {user.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="profile-completion-box">
            <div className="profile-completion-header">
              <span className="completion-title">{t("profile.completeness")}</span>
              <span className="completion-percent">{completionScore}%</span>
            </div>
            <div className="profile-completion-bar-bg">
              <div
                className="profile-completion-bar-fill"
                style={{ width: `${completionScore}%` }}
              />
            </div>
            {firstMissing && completionScore < 100 && (
              <p className="completion-hint">
                <Sparkles size={13} style={{ display: "inline", marginRight: 5, color: "var(--amber)" }} />
                Add your <strong>&nbsp;{firstMissing.name}&nbsp;</strong> to reach 100% completion.
              </p>
            )}
          </div>

          <div className="profile-stats-row">
            <div className="profile-stat-card">
              <FileText size={20} className="stat-icon" />
              <div>
                <div className="stat-value">{docCount}</div>
                <div className="stat-label">{t("profile.uploadedRecords")}</div>
              </div>
            </div>
            <div className="profile-stat-card">
              <Globe size={20} className="stat-icon" />
              <div>
                <div className="stat-value">{preferredLang}</div>
                <div className="stat-label">{t("profile.targetLang")}</div>
              </div>
            </div>
            <div className="profile-stat-card">
              <Activity size={20} className="stat-icon" />
              <div>
                <div className="stat-value">{bloodGroup || "Not Set"}</div>
                <div className="stat-label">{t("profile.bloodGroup")}</div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave}>
          {/* SECTION 1: PERSONAL INFORMATION */}
          <div className="profile-card">
            <div className="profile-card__header">
              <div className="profile-card__icon">
                <User size={20} />
              </div>
              <div>
                <h3 className="profile-card__title">{t("profile.personalInfo")}</h3>
                <p className="profile-card__subtitle">{t("profile.personalInfoSub")}</p>
              </div>
            </div>

            <div className="profile-form-grid">
              <Field label={t("profile.fullName")}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("auth.namePlaceholder")}
                  required
                />
              </Field>

              <Field label={t("profile.age")}>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder={t("auth.agePlaceholder")}
                  min="0"
                  max="120"
                />
              </Field>

              <Field label={t("profile.gender")}>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="Female">{t("auth.genderFemale")}</option>
                  <option value="Male">{t("auth.genderMale")}</option>
                  <option value="Other">{t("auth.genderOther")}</option>
                  <option value="Prefer not to say">{t("auth.genderPreferNot")}</option>
                </select>
              </Field>

              <Field label={t("profile.phone")}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("auth.phonePlaceholder")}
                />
              </Field>
            </div>
          </div>

          {/* SECTION 2: MEDICAL BASELINE & EMERGENCY INFO */}
          <div className="profile-card">
            <div className="profile-card__header">
              <div className="profile-card__icon" style={{ background: "rgba(225, 29, 72, 0.1)", color: "#e11d48" }}>
                <Activity size={20} />
              </div>
              <div>
                <h3 className="profile-card__title">{t("profile.medicalBaseline")}</h3>
                <p className="profile-card__subtitle">{t("profile.medicalBaselineSub")}</p>
              </div>
            </div>

            <div className="profile-form-grid">
              <Field label={t("profile.bloodGroup")}>
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Select {t("profile.bloodGroup")}</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </Field>

              <Field label={t("profile.emergencyContact")}>
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder={t("profile.emergencyContactPlaceholder")}
                />
              </Field>

              <div className="profile-field-full">
                <Field label={t("profile.knownAllergies")} hint="e.g. Penicillin, Sulfa drugs, Peanuts, Latex">
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder={t("profile.allergiesPlaceholder")}
                  />
                </Field>
              </div>

              <div className="profile-field-full">
                <Field label={t("profile.medicalBaseline")} hint="e.g. Type 2 Diabetes, Hypertension, Asthma">
                  <textarea
                    rows={2}
                    value={medicalConditions}
                    onChange={(e) => setMedicalConditions(e.target.value)}
                    placeholder={t("profile.conditionsPlaceholder")}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* SECTION 3: APP & ACCESSIBILITY PREFERENCES */}
          <div className="profile-card">
            <div className="profile-card__header">
              <div className="profile-card__icon" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#2563eb" }}>
                <Globe size={20} />
              </div>
              <div>
                <h3 className="profile-card__title">{t("profile.langSettings")}</h3>
                <p className="profile-card__subtitle">{t("profile.langSettingsSub")}</p>
              </div>
            </div>

            <div className="profile-form-grid">
              <Field label={t("dashboard.preferredLang")} hint="Used automatically when processing uploaded prescriptions">
                <select value={preferredLang} onChange={(e) => setPreferredLang(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={t("profile.audioSpeed")} hint={t("profile.audioSpeedHint")}>
                <select value={narrationSpeed} onChange={(e) => setNarrationSpeed(e.target.value)}>
                  <option value="0.8">0.8x (Slower & Clearer)</option>
                  <option value="1.0">1.0x (Standard Speed)</option>
                  <option value="1.2">1.2x (Faster)</option>
                </select>
              </Field>
            </div>
          </div>

          {/* DIGITAL EMERGENCY MEDICAL PASS FEATURE */}
          <div className="profile-card emergency-pass-card">
            <div className="profile-card__header">
              <div className="profile-card__icon" style={{ background: "rgba(217, 119, 6, 0.12)", color: "#d97706" }}>
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="profile-card__title">{t("profile.emergencyPass")}</h3>
                <p className="profile-card__subtitle">{t("profile.emergencyPassSub")}</p>
              </div>
            </div>

            <div className="emergency-pass-body">
              <div className="emergency-pass-chip-header">
                <div className="pass-chip-title">{t("profile.emergencyPassTitle")}</div>
                <div className="pass-chip-id">ID: {patient?.id || "N/A"}</div>
              </div>

              <div className="emergency-pass-details">
                <div className="pass-detail-item">
                  <span className="pass-label">{t("profile.patientName")}</span>
                  <span className="pass-val">{name || "—"}</span>
                </div>
                <div className="pass-detail-item">
                  <span className="pass-label">{t("profile.ageGender")}</span>
                  <span className="pass-val">{age ? `${age} yrs` : "—"} / {gender || "—"}</span>
                </div>
                <div className="pass-detail-item">
                  <span className="pass-label">{t("profile.bloodGroup")}</span>
                  <span className="pass-val pass-highlight">{bloodGroup || "Not specified"}</span>
                </div>
                <div className="pass-detail-item">
                  <span className="pass-label">{t("profile.emergencyContact")}</span>
                  <span className="pass-val">{emergencyContact || "Not set"}</span>
                </div>
                <div className="pass-detail-item full-width">
                  <span className="pass-label">{t("profile.knownAllergies")}</span>
                  <span className="pass-val">{allergies || "No allergies listed"}</span>
                </div>
                <div className="pass-detail-item full-width">
                  <span className="pass-label">{t("profile.medicalConditions")}</span>
                  <span className="pass-val">{medicalConditions || "No chronic conditions listed"}</span>
                </div>
              </div>

              <div className="emergency-pass-actions">
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={handleCopyEmergencyPass}
                >
                  {copiedPass ? <Check size={14} style={{ color: "var(--teal)" }} /> : <Copy size={14} />}
                  {copiedPass ? t("profile.copiedPass") : t("profile.copyPass")}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => window.print()}
                >
                  <FileText size={14} /> {t("profile.printPass")}
                </button>
              </div>
            </div>
          </div>

          {/* SAVE ACTION BAR */}
          <div className="profile-actions-bar">
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {t("profile.ensureSaved")}
            </span>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? <span className="spinner" /> : t("common.save")}
            </button>
          </div>
        </form>

        {/* DANGER ZONE CARD */}
        <div className="profile-card" style={{ marginTop: 32, border: "1px solid rgba(225, 29, 72, 0.2)" }}>
          <div className="profile-card__header">
            <div className="profile-card__icon" style={{ background: "rgba(225, 29, 72, 0.1)", color: "#e11d48" }}>
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="profile-card__title" style={{ color: "var(--brick)" }}>{t("profile.dangerZone")}</h3>
              <p className="profile-card__subtitle">{t("profile.deleteSubtitle")}</p>
            </div>
          </div>

          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 16 }}>
            Deleting your profile will permanently erase all uploaded medical documents, translated records, and login credentials.
          </p>

          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleDeleteAccount}
            style={{ color: "var(--brick)", borderColor: "rgba(225, 29, 72, 0.4)" }}
          >
            <Trash2 size={15} /> Delete my account
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// EMERGENCY INFORMATION ASSISTANCE SCREEN
// ---------------------------------------------------------------------------

const FIRST_AID_GUIDES = [
  {
    id: "cpr",
    title: "CPR (Cardiopulmonary Resuscitation)",
    category: "cardiac",
    severity: "CRITICAL",
    summary: "For unresponsive victim not breathing or only gasping.",
    steps: [
      "Check safety & tap shoulders asking loudly 'Are you OK?'",
      "Call National Emergency 112 / 108 immediately or ask someone nearby to call.",
      "Place heel of one hand in center of chest, interlock other hand on top.",
      "Push hard and fast: 100 to 120 compressions/min at 2 inches (5 cm) depth.",
      "Allow chest to recoil fully between compressions. Continue until help arrives."
    ],
    dos: ["Push hard and fast in center of chest", "Keep arms straight and shoulders over hands"],
    donts: ["Do not stop compressions unless victim moves or help takes over", "Do not press on ribs or lower abdomen"]
  },
  {
    id: "choking",
    title: "Choking (Heimlich Maneuver)",
    category: "cardiac",
    severity: "CRITICAL",
    summary: "For victim unable to speak, cough, or breathe.",
    steps: [
      "Stand behind the person, wrap your arms around their waist.",
      "Make a fist with one hand and place thumb side against abdomen just above navel.",
      "Grasp fist with other hand and perform quick, upward abdominal thrusts.",
      "Repeat thrusts until object is expelled or person becomes unconscious.",
      "If unconscious, lower to ground and begin CPR compressions."
    ],
    dos: ["Encourage coughing if person can cough forcefully", "Perform quick upward abdominal thrusts"],
    donts: ["Do not perform blind finger sweeps in mouth", "Do not slap back if person is upright and coughing"]
  },
  {
    id: "bleeding",
    title: "Severe Bleeding & Wound Pressure",
    category: "trauma",
    severity: "HIGH",
    summary: "Control rapid arterial or heavy venous blood loss.",
    steps: [
      "Apply firm, continuous direct pressure with sterile cloth or clean hands.",
      "Keep pressure applied for at least 10 minutes without lifting cloth to check.",
      "If blood soaks through, add more cloth on top; DO NOT remove original cloth.",
      "Elevate wounded limb above heart level if no bone fracture is suspected.",
      "Seek urgent medical help at nearest trauma center."
    ],
    dos: ["Apply firm direct pressure continuously", "Elevate injured limb if safe"],
    donts: ["Do not remove embedded objects from wound", "Do not remove soaked bandages"]
  },
  {
    id: "burns",
    title: "Burns & Thermal Scalds",
    category: "trauma",
    severity: "HIGH",
    summary: "Cool burn area and prevent skin infection.",
    steps: [
      "Cool burn immediately under cool running tap water for 10-20 minutes.",
      "Remove tight clothing, rings, or watches near burn before swelling starts.",
      "Cover burn loosely with clean non-stick sterile gauze or plastic wrap.",
      "Keep victim warm and seek medical care for large, facial, or blistering burns."
    ],
    dos: ["Use cool running water immediately", "Cover loosely with clean non-stick wrap"],
    donts: ["Never apply ice, butter, oil, or toothpaste to burn", "Do not pop blisters"]
  },
  {
    id: "fracture",
    title: "Bone Fractures & Limb Trauma",
    category: "trauma",
    severity: "MODERATE",
    summary: "Immobilize limb and minimize pain/swelling.",
    steps: [
      "Keep injured limb completely still in position found.",
      "Support limb using padded splint, rolled newspaper, or sling.",
      "Apply cold ice pack wrapped in cloth for 15 minutes to reduce swelling.",
      "Check for normal skin color, temperature, and pulse beyond fracture site."
    ],
    dos: ["Immobilize joint above and below fracture", "Apply cold pack wrapped in towel"],
    donts: ["Do not attempt to straighten bent or deformed bones", "Do not push protruding bones back in"]
  },
  {
    id: "stroke",
    title: "Stroke Emergency (F.A.S.T Protocol)",
    category: "crises",
    severity: "CRITICAL",
    summary: "Recognize brain stroke symptoms immediately.",
    steps: [
      "F - Face Drooping: Ask person to smile. Does one side of face droop?",
      "A - Arm Weakness: Ask person to raise both arms. Does one arm drift downward?",
      "S - Speech Difficulty: Ask person to repeat simple phrase. Is speech slurred or strange?",
      "T - Time to Call 112/108: If any of these signs appear, call emergency ambulance immediately!",
      "Note exact time when first symptoms started and keep patient resting still."
    ],
    dos: ["Call 108/112 ambulance instantly", "Note exact time of symptom onset"],
    donts: ["Do not give food, water, or aspirin", "Do not allow patient to sleep or drive"]
  },
  {
    id: "heartattack",
    title: "Heart Attack Immediate Action",
    category: "cardiac",
    severity: "CRITICAL",
    summary: "Chest pressure, arm pain, shortness of breath, cold sweat.",
    steps: [
      "Call emergency ambulance 108 / 112 immediately.",
      "Have patient sit down in comfortable half-sitting position on floor.",
      "Loosen tight clothing around neck and chest.",
      "If patient has prescribed nitroglycerin, help them take it. If not allergic, chew 300mg aspirin.",
      "Monitor pulse and breathing closely. Prepare to perform CPR if patient stops breathing."
    ],
    dos: ["Keep patient calm and seated", "Call emergency ambulance right away"],
    donts: ["Do not let patient walk or exert themselves", "Do not leave patient alone"]
  },
  {
    id: "seizure",
    title: "Seizures & Fits Response",
    category: "crises",
    severity: "HIGH",
    summary: "Protect patient from self-injury during convulsions.",
    steps: [
      "Ease patient onto floor and clear surrounding area of sharp objects.",
      "Place soft cushion or folded jacket under patient's head.",
      "Turn patient gently onto one side (recovery position) to keep airway clear.",
      "Time the duration of seizure. Call 108/112 if seizure lasts longer than 5 minutes.",
      "Stay with patient until fully conscious and oriented."
    ],
    dos: ["Turn patient on side", "Time length of seizure"],
    donts: ["Do not put anything inside patient's mouth", "Do not hold or restrain patient's movements"]
  },
  {
    id: "snakebite",
    title: "Snake Bites & Envenomation",
    category: "environmental",
    severity: "CRITICAL",
    summary: "Immobilize bitten limb and rush to hospital for antivenom.",
    steps: [
      "Keep patient calm, reassuring them that most bites are treatable.",
      "Immobilize bitten limb below heart level. Remove rings, footwear, or tight bands.",
      "Clean bite site gently with soap and water or dry wipe.",
      "Transport immediately to hospital with Anti-Snake Venom (ASV) capacity.",
      "Remember snake appearance (color/pattern) from distance if safe to report."
    ],
    dos: ["Immobilize limb with splint", "Rush to hospital immediately"],
    donts: ["Do NOT cut, suck, or apply tourniquet/ice to bite", "Do not attempt to catch snake"]
  },
  {
    id: "heatstroke",
    title: "Heatstroke & Hyperthermia",
    category: "environmental",
    severity: "HIGH",
    summary: "High body temp (>40°C), confusion, dry/flushed skin.",
    steps: [
      "Move victim to cool, shaded or air-conditioned space immediately.",
      "Remove heavy outer clothing.",
      "Apply cold wet cloths, ice packs to armpits, neck, groin, and back.",
      "Fan victim vigorously while spraying cool water.",
      "Sip cool water or ORS rehydration solution ONLY if fully conscious."
    ],
    dos: ["Cool body rapidly with wet towels/ice", "Move to shade/AC"],
    donts: ["Do not force fluids if confused or unconscious", "Do not give alcoholic beverages"]
  }
];

const NATIONAL_HELPLINES = [
  { number: "112", label: "National Emergency Number", subtitle: "All Emergencies (Police, Fire, Ambulance)" },
  { number: "108", label: "Emergency Medical & Ambulance", subtitle: "24/7 Disaster & Medical Response" },
  { number: "102", label: "Free Govt Health Ambulance", subtitle: "Maternal & Emergency Transport" },
  { number: "100", label: "Police Control Room", subtitle: "Crime, Safety & Emergency Help" },
  { number: "101", label: "Fire & Rescue Services", subtitle: "Fire Hazards & Structural Rescue" },
  { number: "14477", label: "Tele-MANAS Mental Health", subtitle: "24/7 Psychological Support Helpline" },
  { number: "1091", label: "Women Helpline", subtitle: "Women Safety & Emergency Assistance" },
  { number: "1098", label: "Child Emergency Helpline", subtitle: "Child Protection & Care Assistance" },
];

function EmergencyScreen({ role, patientProfile, onNav, onLogout }) {
  const { t } = useAppLanguage();
  const [activeTab, setActiveTab] = useState("facilities"); // "facilities", "firstaid", "helplines", "ambulance"
  const [gpsStatus, setGpsStatus] = useState("idle"); // "idle" | "detecting" | "success" | "denied"
  const [userCoords, setUserCoords] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5.0);
  const [facilityType, setFacilityType] = useState("all");
  const [manualCity, setManualCity] = useState("");

  const [firstAidCategory, setFirstAidCategory] = useState("all");
  const [firstAidQuery, setFirstAidQuery] = useState("");
  const [expandedGuideId, setExpandedGuideId] = useState("cpr");

  const [patientCondition, setPatientCondition] = useState("Breathing Difficulty / Asphyxia");
  const [dispatchPhone, setDispatchPhone] = useState(patientProfile?.phone_number || patientProfile?.emergency_contact || "");
  const [dispatchLandmark, setDispatchLandmark] = useState("");

  // Detect GPS on initial mount
  useEffect(() => {
    handleDetectGPS();
  }, []);

  function handleDetectGPS() {
    if (!navigator.geolocation) {
      toast("Geolocation is not supported by your browser.", "error");
      setGpsStatus("denied");
      fetchFacilities(28.6139, 77.2090, radiusKm, facilityType);
      return;
    }
    setGpsStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserCoords({ lat, lng });
        setGpsStatus("success");
        fetchFacilities(lat, lng, radiusKm, facilityType);
      },
      () => {
        toast("GPS access unavailable. Using central regional locator.", "error");
        setGpsStatus("denied");
        const defaultLat = 28.6139;
        const defaultLng = 77.2090;
        setUserCoords({ lat: defaultLat, lng: defaultLng });
        fetchFacilities(defaultLat, defaultLng, radiusKm, facilityType);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  async function fetchFacilities(lat, lng, rKm, fType) {
    setLoadingFacilities(true);
    try {
      const data = await api.getNearbyFacilities(lat, lng, rKm, fType);
      setFacilities(data.facilities || []);
    } catch (err) {
      toast("Failed to load facilities: " + err.message, "error");
    } finally {
      setLoadingFacilities(false);
    }
  }

  function handleRefetchWithParams(rKm, fType) {
    setRadiusKm(rKm);
    setFacilityType(fType);
    const lat = userCoords?.lat || 28.6139;
    const lng = userCoords?.lng || 77.2090;
    fetchFacilities(lat, lng, rKm, fType);
  }

  function handleManualSearch(e) {
    e.preventDefault();
    if (!manualCity.trim()) return;
    toast(`Searching healthcare facilities in "${manualCity}"...`);
    const lat = userCoords?.lat || 28.6139;
    const lng = userCoords?.lng || 77.2090;
    fetchFacilities(lat, lng, radiusKm, facilityType);
  }

  function getEmergencyLocationText() {
    if (userCoords) {
      return `EMERGENCY MEDICAL AID NEEDED! My GPS Location coordinates: https://www.google.com/maps?q=${userCoords.lat},${userCoords.lng}`;
    }
    return `EMERGENCY MEDICAL AID NEEDED! Location: ${manualCity || "Current Location"}`;
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(getEmergencyLocationText());
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  }

  async function handleCopyLocationLink() {
    try {
      await navigator.clipboard.writeText(getEmergencyLocationText());
      toast("Emergency location link copied to clipboard!");
    } catch (err) {
      toast("Failed to copy link: " + err.message, "error");
    }
  }

  function handleDispatchSubmit(e) {
    e.preventDefault();
    showConfirm({
      title: "Confirm Emergency Ambulance Request?",
      message: `Requesting 108 Emergency Ambulance dispatch for condition: "${patientCondition}". Ensure your location is clear.`,
      confirmLabel: "Call 108 Ambulance Now",
      onConfirm: () => {
        window.location.href = "tel:108";
        toast("Initiating 108 Ambulance Dispatch Call...", "success");
      },
    });
  }

  const filteredGuides = FIRST_AID_GUIDES.filter((g) => {
    const matchCat = firstAidCategory === "all" || g.category === firstAidCategory;
    const matchQ =
      !firstAidQuery.trim() ||
      g.title.toLowerCase().includes(firstAidQuery.toLowerCase()) ||
      g.summary.toLowerCase().includes(firstAidQuery.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <Shell
      role={role}
      active="emergency"
      onNav={onNav}
      onLogout={onLogout}
      title={t("emergency.title")}
      subtitle={t("emergency.subtitle")}
    >
      {/* Top Banner Alert Bar */}
      <div className="emergency-alert-banner">
        <div className="emergency-banner-info">
          <div className="emergency-icon-ring">
            <ShieldAlert size={28} color="#ffffff" />
          </div>
          <div>
            <h2 className="emergency-banner-title">{t("emergency.title")}</h2>
            <p className="emergency-banner-sub">
              If someone is unresponsive or in critical danger, call National Emergency <strong>112</strong> or Medical Helpline <strong>108</strong> immediately.
            </p>
          </div>
        </div>

        <div className="emergency-quick-actions">
          <a href="tel:112" className="btn btn--emergency-dial">
            <PhoneCall size={16} /> {t("emergency.call112")}
          </a>
          <a href="tel:108" className="btn btn--ambulance-dial">
            <HeartPulse size={16} /> {t("emergency.call108")}
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="emergency-tab-nav" style={{ marginTop: 20 }}>
        <button
          className={`emergency-tab-btn ${activeTab === "facilities" ? "active" : ""}`}
          onClick={() => setActiveTab("facilities")}
        >
          <MapPin size={16} /> {t("emergency.findNearby")}
        </button>
        <button
          className={`emergency-tab-btn ${activeTab === "firstaid" ? "active" : ""}`}
          onClick={() => setActiveTab("firstaid")}
        >
          <HeartPulse size={16} /> {t("emergency.firstAidTitle")}
        </button>
        <button
          className={`emergency-tab-btn ${activeTab === "helplines" ? "active" : ""}`}
          onClick={() => setActiveTab("helplines")}
        >
          <PhoneCall size={16} /> {t("emergency.nationalHelplines")}
        </button>
        <button
          className={`emergency-tab-btn ${activeTab === "ambulance" ? "active" : ""}`}
          onClick={() => setActiveTab("ambulance")}
        >
          <Navigation size={16} /> {t("emergency.govAmbulance")}
        </button>
      </div>

      {/* TAB 1: NEARBY HEALTHCARE FACILITIES */}
      {activeTab === "facilities" && (
        <div className="section" style={{ marginTop: 20 }}>
          <div className="facilities-header-row">
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{t("emergency.findNearby")}</h2>
              <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 13 }}>
                {t("emergency.subtitle")}
              </p>
            </div>

            <button className="btn btn--secondary" onClick={handleDetectGPS} disabled={gpsStatus === "detecting"}>
              {gpsStatus === "detecting" ? (
                <>
                  <Loader2 size={16} className="spin" /> {t("common.loading")}
                </>
              ) : (
                <>
                  <Crosshair size={16} color="var(--teal)" /> {t("emergency.useGPS")}
                </>
              )}
            </button>
          </div>

          {/* Location Controls & Filters */}
          <div className="facility-filter-bar">
            <div className="filter-group">
              <span className="filter-label">{t("docDetail.type")}</span>
              <div className="chip-buttons">
                {["all", "hospital", "pharmacy", "clinic"].map((tType) => (
                  <button
                    key={tType}
                    className={`chip-btn ${facilityType === tType ? "active" : ""}`}
                    onClick={() => handleRefetchWithParams(radiusKm, tType)}
                  >
                    {tType === "all" ? t("emergency.allTypes") : tType === "hospital" ? t("emergency.hospitals") : tType === "pharmacy" ? t("emergency.pharmacies") : t("emergency.clinics")}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">{t("emergency.searchRadius")}</span>
              <div className="chip-buttons">
                {[2, 5, 10, 25].map((r) => (
                  <button
                    key={r}
                    className={`chip-btn ${radiusKm === r ? "active" : ""}`}
                    onClick={() => handleRefetchWithParams(r, facilityType)}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleManualSearch} className="manual-location-form">
              <input
                type="text"
                placeholder={t("emergency.searchCityPlaceholder")}
                value={manualCity}
                onChange={(e) => setManualCity(e.target.value)}
              />
              <button type="submit" className="btn btn--secondary" style={{ padding: "6px 12px", fontSize: 12 }}>
                {t("assistant.askButton")}
              </button>
            </form>
          </div>

          {/* Location Status Info Bar */}
          <div className="gps-status-badge">
            <MapPin size={14} color="var(--teal)" />
            <span>
              {userCoords
                ? `GPS Active: Latitude ${roundCoords(userCoords.lat)}, Longitude ${roundCoords(userCoords.lng)}`
                : "Location detection active"}
            </span>
          </div>

          {/* Facility List */}
          {loadingFacilities ? (
            <div className="loading-box" style={{ padding: 40 }}>
              <div className="pulse-ring" />
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>{t("emergency.searchingFacilities")}</p>
            </div>
          ) : facilities.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle size={32} color="var(--ink-soft)" />
              <p>{t("emergency.noFacilities")}</p>
            </div>
          ) : (
            <div className="facilities-grid">
              {facilities.map((f) => (
                <div key={f.id} className="facility-card">
                  <div className="facility-card__header">
                    <div>
                      <h3 className="facility-name">{f.name}</h3>
                      <div className="facility-tags">
                        <span className={`badge ${f.type === "Hospital" ? "badge--teal" : "badge--gold"}`}>
                          {f.type}
                        </span>
                        {f.emergency_24x7 && (
                          <span className="badge badge--brick" style={{ fontSize: 11 }}>
                            {t("emergency.open247")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="facility-dist-pill">
                      <strong>{f.distance_km} km</strong> away
                    </div>
                  </div>

                  <p className="facility-address">
                    <MapPin size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {f.address}
                  </p>

                  <div className="facility-actions">
                    {f.phone && (
                      <a href={`tel:${f.phone}`} className="btn btn--secondary btn--sm">
                        <PhoneCall size={13} /> Call: {f.phone}
                      </a>
                    )}
                    <a
                      href={f.maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--primary btn--sm"
                    >
                      <Navigation size={13} /> Directions & Maps <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FIRST AID GUIDANCE */}
      {activeTab === "firstaid" && (
        <div className="section" style={{ marginTop: 20 }}>
          <div className="first-aid-header-row">
            <div>
              <h2 style={{ margin: 0, fontSize: 18 }}>{t("emergency.firstAidTitle")}</h2>
              <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 13 }}>
                Essential medical response procedures for life-threatening emergencies and injuries
              </p>
            </div>

            <div className="search-box" style={{ width: 260 }}>
              <Search size={15} color="var(--ink-soft)" />
              <input
                type="text"
                placeholder={t("emergency.searchFirstAid")}
                value={firstAidQuery}
                onChange={(e) => setFirstAidQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="chip-buttons" style={{ marginTop: 16, marginBottom: 20 }}>
            {[
              { id: "all", label: "All Emergency Guides" },
              { id: "cardiac", label: "Cardiac & Resuscitation" },
              { id: "trauma", label: "Bleeding & Trauma" },
              { id: "crises", label: "Stroke & Seizures" },
              { id: "environmental", label: "Environmental & Envenomation" },
            ].map((c) => (
              <button
                key={c.id}
                className={`chip-btn ${firstAidCategory === c.id ? "active" : ""}`}
                onClick={() => setFirstAidCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Guides Grid / Accordion */}
          <div className="first-aid-grid">
            {filteredGuides.map((guide) => {
              const isExpanded = expandedGuideId === guide.id;
              return (
                <div
                  key={guide.id}
                  className={`first-aid-card ${isExpanded ? "first-aid-card--expanded" : ""}`}
                >
                  <div
                    className="first-aid-card__header"
                    onClick={() => setExpandedGuideId(isExpanded ? null : guide.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div className={`severity-indicator severity--${guide.severity.toLowerCase()}`}>
                        <ShieldAlert size={18} />
                      </div>
                      <div>
                        <h3 className="guide-title">{guide.title}</h3>
                        <p className="guide-summary">{guide.summary}</p>
                      </div>
                    </div>
                    <span className={`badge badge--${guide.severity === "CRITICAL" ? "brick" : "gold"}`}>
                      {guide.severity}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="first-aid-card__body fade-in">
                      <h4 className="guide-subtitle">{t("emergency.actionPlan")}</h4>
                      <ol className="guide-steps-list">
                        {guide.steps.map((step, idx) => (
                          <li key={idx}>
                            <span className="step-num">{idx + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>

                      <div className="guide-dos-donts">
                        <div className="dos-box">
                          <h5 style={{ color: "#15803d", margin: "0 0 8px" }}>✔ What to DO</h5>
                          <ul>
                            {guide.dos.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="donts-box">
                          <h5 style={{ color: "#b91c1c", margin: "0 0 8px" }}>✖ What NOT to do</h5>
                          <ul>
                            {guide.donts.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="guide-footer-call">
                        <span>{t("emergency.needAmbulance")}</span>
                        <a href="tel:108" className="btn btn--emergency-dial btn--sm">
                          <PhoneCall size={13} /> Call 108 Ambulance
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EMERGENCY CONTACTS */}
      {activeTab === "helplines" && (
        <div className="section" style={{ marginTop: 20 }}>
          <h2>{t("emergency.nationalHelplines")}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 16 }}>
            Free, toll-free 24/7 national emergency telephone assistance lines
          </p>

          <div className="helpline-grid">
            {NATIONAL_HELPLINES.map((h) => (
              <div key={h.number} className="helpline-card">
                <div className="helpline-card__content">
                  <div className="helpline-number-badge">{h.number}</div>
                  <div>
                    <h3 className="helpline-title">{h.label}</h3>
                    <p className="helpline-sub">{h.subtitle}</p>
                  </div>
                </div>
                <a href={`tel:${h.number}`} className="btn btn--emergency-dial">
                  <PhoneCall size={15} /> Call {h.number}
                </a>
              </div>
            ))}
          </div>

          {/* Personal Emergency Contact from Profile */}
          <div className="section" style={{ marginTop: 24, background: "rgba(13, 148, 136, 0.05)", borderColor: "var(--teal)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <User size={20} color="var(--teal)" />
              <h3 style={{ margin: 0, fontSize: 16 }}>{t("emergency.personalContact")}</h3>
            </div>
            {patientProfile?.emergency_contact ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{patientProfile.emergency_contact}</p>
                  <p style={{ margin: "2px 0 0", color: "var(--ink-soft)", fontSize: 12 }}>{t("emergency.savedInProfile")}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <a href={`tel:${patientProfile.emergency_contact}`} className="btn btn--primary">
                    <PhoneCall size={15} /> Call Saved Contact
                  </a>
                  <button className="btn btn--secondary" onClick={handleShareWhatsApp}>
                    <Share2 size={15} /> SMS Location
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, color: "var(--ink-soft)" }}>{t("emergency.noContactYet")}</p>
                <button className="btn btn--secondary" onClick={() => onNav("profile")}>
                  + Add in Profile
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: AMBULANCE CONTACT & LOCATION BROADCAST */}
      {activeTab === "ambulance" && (
        <div className="section" style={{ marginTop: 20 }}>
          <div className="doc-detail-layout-grid">
            {/* Left Column: Instant Location Broadcast */}
            <div className="doc-detail-main">
              <h2>{t("emergency.locationBroadcast")}</h2>
              <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 16 }}>
                Share your exact GPS coordinates and map directions instantly with family or ambulance drivers.
              </p>

              <div className="location-broadcast-card">
                <div className="broadcast-preview-box">
                  <MapPin size={18} color="var(--brick)" />
                  <p className="broadcast-text">{getEmergencyLocationText()}</p>
                </div>

                <div className="broadcast-actions">
                  <button className="btn btn--whatsapp-share" onClick={handleShareWhatsApp}>
                    <Share2 size={16} /> Share via WhatsApp
                  </button>
                  <button className="btn btn--secondary" onClick={handleCopyLocationLink}>
                    <Copy size={16} /> Copy Location Text
                  </button>
                </div>
              </div>

              {/* Direct Ambulance Dial Callout */}
              <div className="ambulance-direct-callout">
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="bot-avatar-badge" style={{ background: "var(--brick)" }}>
                    <HeartPulse size={22} color="#fff" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{t("emergency.govAmbulance")}</h3>
                    <p style={{ margin: "2px 0 0", color: "var(--ink-soft)", fontSize: 12 }}>
                      Dial 108 (National Medical Emergency Response Service)
                    </p>
                  </div>
                </div>
                <a href="tel:108" className="btn btn--emergency-dial" style={{ padding: "10px 20px" }}>
                  <PhoneCall size={16} /> Dial 108 Ambulance
                </a>
              </div>
            </div>

            {/* Right Column: Ambulance Dispatch Form Simulator */}
            <div className="doc-detail-side-panel">
              <div className="side-card" style={{ borderColor: "rgba(225, 29, 72, 0.3)" }}>
                <div className="side-card__header">
                  <Navigation size={18} color="var(--brick)" />
                  <h3 className="side-card__title">{t("emergency.ambulanceForm")}</h3>
                </div>

                <form onSubmit={handleDispatchSubmit} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                  <Field label={t("emergency.patientCondition")}>
                    <select
                      value={patientCondition}
                      onChange={(e) => setPatientCondition(e.target.value)}
                      style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid var(--border)" }}
                    >
                      <option value="Unconscious / Non-Responsive">{t("emergency.symptomUnconscious")}</option>
                      <option value="Breathing Difficulty / Asphyxia">{t("emergency.symptomBreathing")}</option>
                      <option value="Severe Bleeding & Trauma">{t("emergency.symptomBleeding")}</option>
                      <option value="Chest Pain / Suspected Heart Attack">{t("emergency.symptomChestPain")}</option>
                      <option value="Stroke Symptoms (FAST)">{t("emergency.symptomStroke")}</option>
                      <option value="Burns / Envenomation / Snake Bite">{t("emergency.symptomBurns")}</option>
                    </select>
                  </Field>

                  <Field label={t("emergency.callbackPhone")}>
                    <input
                      type="tel"
                      placeholder={t("auth.phonePlaceholder")}
                      value={dispatchPhone}
                      onChange={(e) => setDispatchPhone(e.target.value)}
                    />
                  </Field>

                  <Field label={t("emergency.addressNotes")}>
                    <input
                      type="text"
                      placeholder={t("emergency.landmarkPlaceholder")}
                      value={dispatchLandmark}
                      onChange={(e) => setDispatchLandmark(e.target.value)}
                    />
                  </Field>

                  <button type="submit" className="btn btn--emergency-dial" style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
                    <PhoneCall size={16} /> Dispatch Emergency Call (108)
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function roundCoords(num) {
  return typeof num === "number" ? num.toFixed(4) : num;
}

// ---------------------------------------------------------------------------
// HEALTH WORKER SCREENS
// ---------------------------------------------------------------------------

function WorkerDashboard({ user, profile, onNav, onOpenPatient, onOpenDocument, onLogout }) {
  const { t } = useAppLanguage();
  const [tab, setTab] = useState("patients"); // "patients", "documents", "stages"
  const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"
  const [patients, setPatients] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New patient modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientAge, setNewPatientAge] = useState("");
  const [newPatientGender, setNewPatientGender] = useState("Female");
  const [newPatientLang, setNewPatientLang] = useState("Hindi");
  const [addingPatient, setAddingPatient] = useState(false);

  // Debug pipeline stage viewer state
  const [selectedStageFile, setSelectedStageFile] = useState("0_raw_extracted_text.txt");
  const [stageContent, setStageContent] = useState("");
  const [loadingStage, setLoadingStage] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [pts, docs] = await Promise.all([
        api.getPatients(),
        api.getAllDocuments(),
      ]);
      setPatients(pts);
      setAllDocs(docs);
    } catch (err) {
      setError(err.message || "Failed to load directory data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAddPatient(e) {
    e.preventDefault();
    if (!newPatientName) return;
    setAddingPatient(true);
    try {
      const created = await api.createPatient({
        name: newPatientName,
        phone_number: newPatientPhone || undefined,
        age: newPatientAge ? parseInt(newPatientAge, 10) : undefined,
        gender: newPatientGender,
        preferred_language: newPatientLang,
      });
      setPatients((prev) => [created, ...prev]);
      setShowAddModal(false);
      setNewPatientName("");
      setNewPatientPhone("");
      setNewPatientAge("");
      toast("Patient registered successfully!");
    } catch (err) {
      toast("Failed to register patient: " + err.message, "error");
    } finally {
      setAddingPatient(false);
    }
  }

  async function handleViewStage(filename) {
    setSelectedStageFile(filename);
    setLoadingStage(true);
    try {
      const content = await api.getStageFile(filename);
      setStageContent(typeof content === "object" ? JSON.stringify(content, null, 2) : content);
    } catch (err) {
      setStageContent("Stage file not found or empty: " + err.message);
    } finally {
      setLoadingStage(false);
    }
  }

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.phone_number && p.phone_number.includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q))
    );
  });

  const { currentPage: patientPage, setCurrentPage: setPatientPage, paginatedItems: paginatedPatients } = usePagination(filteredPatients, 5);
  const { currentPage: docPage, setCurrentPage: setDocPage, paginatedItems: paginatedAllDocs } = usePagination(allDocs, 5);

  return (
    <Shell
      role="healthcare_worker"
      active="dashboard"
      onNav={onNav}
      onLogout={onLogout}
      userName={profile?.name || user?.name || t("role.worker")}
      title={t("dashboard.workerTitle")}
      subtitle={profile?.department ? `${profile.department} · ID: ${profile.employee_id || "Staff"}` : "Manage patient documents, community health records, and AI pipeline outputs."}
    >
      <div className="stat-row">
        <div className="stat">
          <div className="stat__value">{patients.length}</div>
          <div className="stat__label">{t("nav.patientDirectory")}</div>
        </div>
        <div className="stat">
          <div className="stat__value">{allDocs.length}</div>
          <div className="stat__label">{t("nav.documents")}</div>
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "patients" ? "active" : ""}`}
          onClick={() => setTab("patients")}
        >
          <Users size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
          {t("nav.patientDirectory")} ({patients.length})
        </button>
        <button
          className={`tab-btn ${tab === "documents" ? "active" : ""}`}
          onClick={() => setTab("documents")}
        >
          <FileText size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
          {t("nav.documents")} ({allDocs.length})
        </button>
        <button
          className={`tab-btn ${tab === "stages" ? "active" : ""}`}
          onClick={() => {
            setTab("stages");
            handleViewStage(selectedStageFile);
          }}
        >
          <Layers size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Pipeline Stages Inspector
        </button>
      </div>

      {error && (
        <div className="alert alert--error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: PATIENTS DIRECTORY */}
      {tab === "patients" && (
        <>
          <div className="patient-directory-bar">
            <div className="patient-directory-bar__left">
              <div className="search-bar" style={{ flex: 1, maxWidth: 420 }}>
                <Search size={16} />
                <input
                  type="text"
                  placeholder={t("worker.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: "var(--ink-soft)" }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <span className="patient-count-badge">
                {filteredPatients.length} {filteredPatients.length === 1 ? "Patient" : "Patients"}
              </span>
            </div>

            <div className="patient-directory-bar__right">
              <div className="view-mode-toggle">
                <button
                  className={`view-mode-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title={t("worker.gridCardsView")}
                >
                  <Grid size={15} style={{ marginRight: 4 }} /> Cards
                </button>
                <button
                  className={`view-mode-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title={t("worker.tableListView")}
                >
                  <List size={15} style={{ marginRight: 4 }} /> List
                </button>
              </div>

              <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} /> {t("worker.registerPatient")}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-box">
              <div className="pulse-ring" />
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>{t("worker.loadingDirectory")}</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="empty-state">
              <Users size={40} color="var(--ink-faint)" />
              <h4 style={{ margin: "12px 0 4px", fontSize: 16 }}>{t("worker.noPatientsFound")}</h4>
              <p style={{ color: "var(--ink-soft)", fontSize: 13, margin: 0 }}>
                {searchQuery ? `No results matching "${searchQuery}". Try a different keyword.` : "Click 'Register new patient' to add your first patient."}
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <>
              <div className="patient-cards">
                {paginatedPatients.map((p) => {
                  const docCount = allDocs.filter((d) => d.patient_id === p.id).length;
                  const initials = p.name
                    ? p.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()
                    : "P";

                  return (
                    <div
                      key={p.id}
                      className="patient-card"
                      onClick={() => onOpenPatient(p)}
                      style={{ cursor: "pointer" }}
                    >
                      <div>
                        {/* Header with Avatar & ID */}
                        <div className="patient-card__header">
                          <div className="patient-card__avatar">{initials}</div>
                          <div className="patient-card__title-wrap">
                            <div className="patient-card__name" title={p.name}>
                              {p.name || "Unnamed Patient"}
                            </div>
                            <span className="patient-card__id-badge">
                              ID: {p.id ? (p.id.length > 12 ? p.id.slice(0, 10) + "…" : p.id) : "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Body Details Segregation */}
                        <div className="patient-card__body">
                          <div className="patient-card__row">
                            <User size={14} />
                            <span className="patient-card__label">{t("worker.demographics")}:</span>
                            <span className="patient-card__val">
                              {p.age ? `${p.age} yrs` : "Age unrecorded"} · {p.gender || "Gender unrecorded"}
                            </span>
                          </div>

                          <div className="patient-card__row">
                            <Phone size={14} />
                            <span className="patient-card__label">{t("worker.phone")}:</span>
                            <span className="patient-card__val">{p.phone_number || "Not provided"}</span>
                          </div>

                          <div className="patient-card__row">
                            <FileText size={14} />
                            <span className="patient-card__label">{t("worker.documents")}:</span>
                            <span className="patient-card__val">
                              {docCount} {docCount === 1 ? "record" : "records"}
                            </span>
                          </div>

                          <div className="patient-card__badges">
                            <span className="badge badge--teal">
                              <Globe size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />
                              {getLanguageName(p.preferred_language || "Hindi")}
                            </span>
                            {docCount > 0 && (
                              <span className="badge badge--sage">
                                {docCount} {docCount === 1 ? "Doc Attached" : "Docs Attached"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="patient-card__footer">
                        <button
                          className="patient-card__btn-view"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPatient(p);
                          }}
                        >
                          View Records <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination
                currentPage={patientPage}
                totalItems={filteredPatients.length}
                pageSize={5}
                onPageChange={setPatientPage}
              />
            </>
          ) : (
            <>
              {/* TABLE VIEW */}
              <div className="patient-table-card">
                <table className="patient-table">
                  <thead>
                    <tr>
                      <th>{t("role.patient")}</th>
                      <th>{t("worker.demographics")}</th>
                      <th>{t("reminders.phone")}</th>
                      <th>{t("common.language")}</th>
                      <th>{t("nav.documents")}</th>
                      <th style={{ textAlign: "right" }}>{t("dashboard.viewDetails")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPatients.map((p) => {
                      const docCount = allDocs.filter((d) => d.patient_id === p.id).length;
                      const initials = p.name
                        ? p.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .substring(0, 2)
                            .toUpperCase()
                        : "P";

                      return (
                        <tr key={p.id} onClick={() => onOpenPatient(p)} style={{ cursor: "pointer" }}>
                          <td>
                            <div className="patient-table__name-cell">
                              <div className="patient-card__avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "var(--ink)" }}>{p.name || "Unnamed"}</div>
                                <div className="patient-card__id-badge" style={{ fontSize: 10 }}>
                                  {p.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: 500 }}>
                              {p.age ? `${p.age} yrs` : "Age N/A"}
                            </span>
                            <span style={{ color: "var(--ink-soft)", marginLeft: 4 }}>
                              ({p.gender || "Unspecified"})
                            </span>
                          </td>
                          <td style={{ color: "var(--ink-soft)" }}>
                            {p.phone_number ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Phone size={12} color="var(--teal)" /> {p.phone_number}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>
                            <span className="badge badge--teal" style={{ fontSize: 11 }}>
                              {getLanguageName(p.preferred_language || "Hindi")}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${docCount > 0 ? "badge--sage" : "badge--paper"}`}>
                              <FileText size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />
                              {docCount} {docCount === 1 ? "Doc" : "Docs"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="btn btn--secondary"
                              style={{ padding: "5px 12px", fontSize: 12 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPatient(p);
                              }}
                            >
                              Open <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={patientPage}
                totalItems={filteredPatients.length}
                pageSize={5}
                onPageChange={setPatientPage}
              />
            </>
          )}
        </>
      )}

      {/* TAB 2: ALL DOCUMENTS */}
      {tab === "documents" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>All Processed Documents ({allDocs.length})</h2>
            <button className="btn btn--secondary" onClick={loadData} style={{ padding: "6px 12px", fontSize: 12 }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="loading-box">
              <div className="pulse-ring" />
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>{t("worker.loadingDocs")}</p>
            </div>
          ) : allDocs.length === 0 ? (
            <div className="empty-state">
              <FileText size={36} color="var(--ink-faint)" />
              <p>{t("worker.noDocsYet")}</p>
            </div>
          ) : (
            <>
              <div className="doc-list">
                {paginatedAllDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="doc-row"
                    onClick={() => onOpenDocument(doc.id)}
                    style={{ cursor: "pointer" }}
                  >
                    <div>
                      <div className="doc-row__type">{doc.document_type || "Medical Document"}</div>
                      <div className="doc-row__meta">
                        {doc.original_filename} · Patient ID: {doc.patient_id ? doc.patient_id.slice(0, 8) : "—"} · {new Date(doc.uploaded_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="doc-row__right">
                      <button
                        className="btn btn--secondary"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await api.downloadDocumentFile(doc.id, doc.original_filename);
                            toast("Download started");
                          } catch (err) {
                            toast("Download failed: " + err.message, "error");
                          }
                        }}
                        title={t("dashboard.downloadOriginal")}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        className="btn btn--secondary"
                        style={{ padding: "6px 10px", fontSize: 12, color: "var(--brick)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          showConfirm({
                            title: "Delete this document?",
                            message: "Are you sure you want to delete this document?",
                            danger: true,
                            confirmLabel: "Delete Document",
                            onConfirm: async () => {
                              try {
                                await api.deleteDocument(doc.id);
                                setAllDocs((prev) => prev.filter((d) => d.id !== doc.id));
                                toast("Document deleted");
                              } catch (err) {
                                toast("Failed to delete document: " + err.message, "error");
                              }
                            },
                          });
                        }}
                        title={t("common.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                currentPage={docPage}
                totalItems={allDocs.length}
                pageSize={5}
                onPageChange={setDocPage}
              />
            </>
          )}
        </>
      )}

      {/* TAB 3: PIPELINE STAGES INSPECTOR */}
      {tab === "stages" && (
        <div className="section">
          <h2>{t("admin.pipelineDebugger")}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginBottom: 16 }}>
            Inspect the intermediate artifacts produced by the OCR and Groq processing stages.
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {[
              { file: "0_raw_extracted_text.txt", label: "0. Raw OCR Text" },
              { file: "2_narrative.txt", label: "2. Medication Narrative" },
              { file: "3_simplified_explanation.txt", label: "3. Simplified Explanation" },
              { file: "4_translated_explanation.txt", label: "4. Translated Text" },
            ].map((stg) => (
              <button
                key={stg.file}
                className={`btn ${selectedStageFile === stg.file ? "btn--primary" : "btn--secondary"}`}
                style={{ fontSize: 12.5, padding: "6px 12px" }}
                onClick={() => handleViewStage(stg.file)}
              >
                {stg.label}
              </button>
            ))}
          </div>

          <div style={{ background: "var(--panel)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-m)", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "var(--ink-soft)" }}>
              <span>{t("admin.viewing")}: <strong>{selectedStageFile}</strong></span>
              <button
                className="btn btn--secondary"
                style={{ padding: "4px 8px", fontSize: 11 }}
                onClick={() => handleViewStage(selectedStageFile)}
              >
                Reload Stage
              </button>
            </div>
            {loadingStage ? (
              <div style={{ padding: 20, textAlign: "center" }}><span className="spinner" /></div>
            ) : (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13, color: "var(--ink)", fontFamily: "monospace", maxHeight: 350, overflowY: "auto" }}>
                {stageContent || "No content found for this stage."}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Add Patient Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{t("worker.registerPatient")}</h2>
              <button
                style={{ background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPatient}>
              <Field label={t("profile.fullName")}>
                <input
                  type="text"
                  placeholder={t("auth.namePlaceholder")}
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  required
                />
              </Field>

              <div className="field-row">
                <Field label={t("profile.age")}>
                  <input
                    type="number"
                    placeholder={t("auth.agePlaceholder")}
                    value={newPatientAge}
                    onChange={(e) => setNewPatientAge(e.target.value)}
                  />
                </Field>
                <Field label={t("profile.gender")}>
                  <select value={newPatientGender} onChange={(e) => setNewPatientGender(e.target.value)}>
                    <option value="Female">{t("auth.genderFemale")}</option>
                    <option value="Male">{t("auth.genderMale")}</option>
                    <option value="Other">{t("auth.genderOther")}</option>
                  </select>
                </Field>
              </div>

              <Field label={t("profile.phone")}>
                <input
                  type="tel"
                  placeholder={t("auth.phonePlaceholder")}
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                />
              </Field>

              <Field label={t("dashboard.preferredLang")}>
                <select value={newPatientLang} onChange={(e) => setNewPatientLang(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  {t("common.cancel")}
                </button>
                <button type="submit" className="btn btn--primary" disabled={addingPatient}>
                  {addingPatient ? <span className="spinner" /> : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

function WorkerPatientDetail({ patient, onNav, onBack, onUploadFor, onOpenDocument, onLogout }) {
  const { t } = useAppLanguage();
  const [patientData, setPatientData] = useState(patient);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentPage, setCurrentPage, paginatedItems: paginatedDocs } = usePagination(documents, 5);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(patient?.name || "");
  const [editPhone, setEditPhone] = useState(patient?.phone_number || "");
  const [editAge, setEditAge] = useState(patient?.age || "");
  const [editGender, setEditGender] = useState(patient?.gender || "Female");
  const [editLang, setEditLang] = useState(patient?.preferred_language || "Hindi");

  async function loadPatientDocs() {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const [pDetails, docs] = await Promise.all([
        api.getPatient(patient.id),
        api.getPatientDocuments(patient.id),
      ]);
      setPatientData(pDetails);
      setDocuments(docs);
      setEditName(pDetails.name || "");
      setEditPhone(pDetails.phone_number || "");
      setEditAge(pDetails.age || "");
      setEditGender(pDetails.gender || "Female");
      setEditLang(pDetails.preferred_language || "Hindi");
    } catch (err) {
      console.error("Failed to load patient records", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatientDocs();
  }, [patient?.id]);

  async function handleSaveEdit(e) {
    e.preventDefault();
    try {
      const updated = await api.updatePatient(patient.id, {
        name: editName,
        phone_number: editPhone,
        age: editAge ? parseInt(editAge, 10) : null,
        gender: editGender,
        preferred_language: editLang,
      });
      setPatientData(updated);
      setEditing(false);
      toast("Patient details updated successfully!");
    } catch (err) {
      toast("Failed to update patient: " + err.message, "error");
    }
  }

  return (
    <Shell
      role="healthcare_worker"
      active="dashboard"
      onNav={onNav}
      onLogout={onLogout}
      title={patientData.name || "Patient Record"}
      subtitle={`${patientData.age ? `${patientData.age} yrs · ` : ""}${patientData.gender || "Gender unrecorded"} · Phone: ${patientData.phone_number || "—"} · Preferred: ${patientData.preferred_language || "Hindi"}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <button className="back-link" onClick={onBack} style={{ margin: 0 }}>
          <ArrowLeft size={15} /> {t("common.back")}
        </button>
        <div>
          <button className="btn btn--secondary" onClick={() => setEditing(!editing)}>
            <Edit3 size={15} /> {editing ? t("common.cancel") : t("common.save")}
          </button>
        </div>
      </div>


      {editing && (
        <form onSubmit={handleSaveEdit} className="section" style={{ background: "var(--panel)", padding: 20, borderRadius: "var(--radius-m)" }}>
          <h3>{t("worker.editPatient")}</h3>
          <div className="field-row">
            <Field label={t("profile.fullName")}>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </Field>
            <Field label={t("profile.age")}>
              <input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} />
            </Field>
          </div>
          <div className="field-row">
            <Field label={t("profile.gender")}>
              <select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                <option value="Female">{t("auth.genderFemale")}</option>
                <option value="Male">{t("auth.genderMale")}</option>
                <option value="Other">{t("auth.genderOther")}</option>
              </select>
            </Field>
            <Field label={t("worker.phone")}>
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </Field>
          </div>
          <Field label={t("dashboard.preferredLang")}>
            <select value={editLang} onChange={(e) => setEditLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.name}>{l.name}</option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn btn--primary">{t("common.save")}</button>
        </form>
      )}

      <div className="section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Documents for {patientData.name ? patientData.name.split(" ")[0] : "this patient"} ({documents.length})</h2>
          <button className="btn btn--primary" onClick={() => onUploadFor(patientData)}>
            <UploadCloud size={15} /> Upload document
          </button>
        </div>

        {loading ? (
          <div className="loading-box">
            <div className="pulse-ring" />
            <p style={{ color: "var(--ink-soft)", margin: 0 }}>Loading patient documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state">
            <FileText size={36} color="var(--ink-faint)" />
            <p>{t("worker.noDocsForPatient")}</p>
            <button className="btn btn--primary" onClick={() => onUploadFor(patientData)}>
              <UploadCloud size={15} /> Upload a document now
            </button>
          </div>
        ) : (
          <>
            <div className="doc-list">
              {paginatedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="doc-row"
                  onClick={() => onOpenDocument(doc.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <div className="doc-row__type">{doc.document_type || "Medical Document"}</div>
                    <div className="doc-row__meta">
                      {doc.original_filename} · {new Date(doc.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="doc-row__right">
                    <StatusDot status="ready" />
                    <button
                      className="btn btn--secondary"
                      style={{ padding: "6px 10px", fontSize: 12 }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await api.downloadDocumentFile(doc.id, doc.original_filename);
                          toast("Download started");
                        } catch (err) {
                          toast("Download failed: " + err.message, "error");
                        }
                      }}
                      title={t("dashboard.downloadOriginal")}
                    >
                      <Download size={14} />
                    </button>
                    <button
                      className="btn btn--secondary"
                      style={{ padding: "6px 10px", fontSize: 12, color: "var(--brick)" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        showConfirm({
                          title: "Delete this document?",
                          message: "Are you sure you want to delete this document?",
                          danger: true,
                          confirmLabel: "Delete Document",
                          onConfirm: async () => {
                            try {
                              await api.deleteDocument(doc.id);
                              setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
                              toast("Document deleted");
                            } catch (err) {
                              toast("Failed to delete document: " + err.message, "error");
                            }
                          },
                        });
                      }}
                      title={t("common.delete")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={documents.length}
              pageSize={5}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// ADMIN DASHBOARD
// ---------------------------------------------------------------------------

function AdminDashboard({ user, onLogout }) {
  const { t } = useAppLanguage();
  const [activePanel, setActivePanel] = useState("overview");

  const adminName = user?.name || user?.email || t("role.admin");

  const panelTitles = {
    overview: { title: t("nav.overview"), subtitle: "Live metrics across the entire platform" },
    users: { title: t("nav.users"), subtitle: "Manage accounts, roles, and verification" },
    patients: { title: t("nav.patientDirectory"), subtitle: "All registered patient profiles with document counts" },
    documents: { title: t("nav.documents"), subtitle: "System-wide uploaded documents" },
  };

  const current = panelTitles[activePanel] || panelTitles["overview"];

  return (
    <Shell
      role="admin"
      active={activePanel}
      onNav={(key) => setActivePanel(key)}
      onLogout={onLogout}
      userName={adminName}
      title={current.title}
      subtitle={current.subtitle}
    >
      {activePanel === "overview" && <AdminOverviewPanel />}
      {activePanel === "users" && <AdminUsersPanel />}
      {activePanel === "patients" && <AdminPatientsPanel />}
      {activePanel === "documents" && <AdminDocumentsPanel />}
    </Shell>
  );
}

// ---- Overview Panel ----
function AdminOverviewPanel() {
  const { t } = useAppLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const recentUploads = stats?.recent_uploads || [];
  const { currentPage, setCurrentPage, paginatedItems: paginatedRecentUploads } = usePagination(recentUploads, 5);

  if (loading) return (
    <div className="admin-loading">
      <div className="pulse-ring" />
      <span>{t("common.loading")}</span>
    </div>
  );

  if (!stats) return <div className="admin-empty"><p>{t("common.error")}</p></div>;

  const maxLangCount = stats.language_breakdown?.length
    ? Math.max(...stats.language_breakdown.map((l) => l.count))
    : 1;

  return (
    <>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon"><Users size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_users ?? 0}</div>
          <div className="admin-stat-card__label">{t("nav.users")}</div>
          <div className="admin-stat-card__sub">
            {stats.users_by_role?.patient ?? 0} {t("role.patient")} · {stats.users_by_role?.healthcare_worker ?? 0} {t("role.worker")} · {stats.users_by_role?.admin ?? 0} {t("role.admin")}
          </div>
        </div>

        <div className="admin-stat-card admin-stat-card--green">
          <div className="admin-stat-card__icon"><User size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_patients ?? 0}</div>
          <div className="admin-stat-card__label">{t("nav.patientDirectory")}</div>
        </div>

        <div className="admin-stat-card admin-stat-card--teal">
          <div className="admin-stat-card__icon"><FileText size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_documents ?? 0}</div>
          <div className="admin-stat-card__label">{t("nav.documents")}</div>
          <div className="admin-stat-card__sub">{stats.total_extractions ?? 0} processed</div>
        </div>

        <div className="admin-stat-card admin-stat-card--gold">
          <div className="admin-stat-card__icon"><ShieldCheck size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_healthcare_workers ?? 0}</div>
          <div className="admin-stat-card__label">{t("role.worker")}</div>
          <div className="admin-stat-card__sub">
            {stats.verified_workers ?? 0} verified · {stats.unverified_workers ?? 0} pending
          </div>
        </div>
      </div>

      <div className="admin-overview-grid">
        {/* Language usage */}
        <div className="admin-panel">
          <div className="admin-panel__header">
            <h3 className="admin-panel__title">
              <Globe size={15} /> Language Usage
            </h3>
            <span className="admin-panel__count">{stats.language_breakdown?.length ?? 0} languages</span>
          </div>
          {stats.language_breakdown?.length ? (
            <div className="admin-lang-chart">
              {stats.language_breakdown.map((l) => (
                <div key={l.language} className="admin-lang-row">
                  <span className="admin-lang-name">{getLanguageName(l.language)}</span>
                  <div className="admin-lang-bar-track">
                    <div
                      className="admin-lang-bar-fill"
                      style={{ width: `${Math.round((l.count / maxLangCount) * 100)}%` }}
                    />
                  </div>
                  <span className="admin-lang-count">{l.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty"><p>{t("admin.noTranslationData")}</p></div>
          )}
        </div>

        {/* Recent uploads */}
        <div className="admin-panel">
          <div className="admin-panel__header">
            <h3 className="admin-panel__title">
              <Activity size={15} /> Recent Uploads
            </h3>
            <span className="admin-panel__count">{t("admin.lastTen") || "last 10"}</span>
          </div>
          {recentUploads.length ? (
            <>
              <ul className="admin-activity-list">
                {paginatedRecentUploads.map((doc) => (
                  <li key={doc.id} className="admin-activity-item">
                    <div className="admin-activity-dot admin-activity-dot--doc" />
                    <div className="admin-activity-text">
                      <strong>{doc.original_filename || "Unnamed file"}</strong>
                      {doc.document_type && (
                        <> · <span style={{ color: "var(--ink-soft)", fontSize: 12 }}>{doc.document_type}</span></>
                      )}
                    </div>
                    <div className="admin-activity-time">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination
                currentPage={currentPage}
                totalItems={recentUploads.length}
                pageSize={5}
                onPageChange={setCurrentPage}
              />
            </>
          ) : (
            <div className="admin-empty"><p>{t("dashboard.noUploads")}</p></div>
          )}
        </div>
      </div>
    </>
  );
}

// ---- Users Panel ----
function AdminUsersPanel() {
  const { t } = useAppLanguage();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [updating, setUpdating] = useState(null);

  async function load() {
    setLoading(true);
    try { setUsers(await api.admin.listUsers()); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handlePromote(user) {
    if (updating) return;
    setUpdating(user.id);
    try {
      await api.admin.updateUser(user.id, { role: "admin" });
      toast(`${user.name || user.email} promoted to Admin`);
      load();
    } catch (err) {
      toast("Failed: " + err.message, "error");
    } finally { setUpdating(null); }
  }

  async function handleToggleVerify(user) {
    if (updating) return;
    setUpdating(user.id);
    const newState = !user.is_verified;
    try {
      await api.admin.updateUser(user.id, { is_verified: newState });
      toast(newState ? "Worker verified" : "Verification revoked");
      load();
    } catch (err) {
      toast("Failed: " + err.message, "error");
    } finally { setUpdating(null); }
  }

  function handleDelete(user) {
    showConfirm({
      title: "Delete user account?",
      message: `This will permanently delete ${user.name || user.email}${
        user.role === "patient" ? " and their linked patient profile and documents" : ""
      }.`,
      danger: true,
      confirmLabel: "Delete User",
      onConfirm: async () => {
        try {
          await api.admin.deleteUser(user.id);
          toast("User deleted");
          load();
        } catch (err) {
          toast("Failed: " + err.message, "error");
        }
      },
    });
  }

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return !q || (u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q) || u.role?.includes(q));
  });

  const { currentPage, setCurrentPage, paginatedItems: paginatedUsers } = usePagination(filtered, 5);

  return (
    <div className="admin-panel">
      <div className="admin-panel__header">
        <h3 className="admin-panel__title">
          <UserCog size={15} /> {t("nav.users")}
          <span className="admin-panel__count">{users.length}</span>
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn--secondary" onClick={load} style={{ fontSize: 12, padding: "6px 10px" }}>
            <RefreshCw size={13} />
          </button>
          <div className="admin-search-wrap">
            <Search size={14} />
            <input
              placeholder={t("dashboard.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="admin-panel__body">
        {loading ? (
          <div className="admin-loading"><div className="pulse-ring" /><span>{t("common.loading")}</span></div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty"><Users size={32} /><p>{t("common.error")}</p></div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("role.patient")}</th>
                    <th>{t("common.language")}</th>
                    <th>{t("dashboard.uploadedOn")}</th>
                    <th>{t("dashboard.uploadedOn")}</th>
                    <th>{t("dashboard.viewDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name || "—"}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-faint)" }}>{u.email}</div>
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge--${u.role === "healthcare_worker" ? "worker" : u.role}`}>
                          {u.role === "healthcare_worker" ? "Worker" : u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                        </span>
                      </td>
                      <td>
                        {u.role === "healthcare_worker" ? (
                          <span className={`admin-badge ${u.is_verified ? "admin-badge--verified" : "admin-badge--unverified"}`}>
                            {u.is_verified ? <BadgeCheck size={11} /> : <Ban size={11} />}
                            {u.is_verified ? t("healthDb.verified") : "Unverified"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ color: "var(--ink-soft)", fontSize: 12 }}>
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="admin-action-group">
                          {u.role === "healthcare_worker" && (
                            <button
                              className="admin-action-btn admin-action-btn--promote admin-action-btn--sm"
                              onClick={() => handlePromote(u)}
                              disabled={updating === u.id}
                              title={t("admin.promoteToAdmin")}
                            >
                              <ShieldCheck size={12} /> Admin
                            </button>
                          )}
                          {u.role === "healthcare_worker" && (
                            <button
                              className={`admin-action-btn admin-action-btn--sm ${u.is_verified ? "admin-action-btn--danger" : "admin-action-btn--verify"}`}
                              onClick={() => handleToggleVerify(u)}
                              disabled={updating === u.id}
                              title={u.is_verified ? "Revoke verification" : "Grant verification"}
                            >
                              {u.is_verified ? <Ban size={12} /> : <BadgeCheck size={12} />}
                              {u.is_verified ? t("admin.revokeVerify") : t("admin.grantVerify")}
                            </button>
                          )}
                          <button
                            className="admin-action-btn admin-action-btn--danger admin-action-btn--sm"
                            onClick={() => handleDelete(u)}
                            disabled={updating === u.id}
                            title={t("admin.deleteUser")}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={5}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---- Patients Panel ----
function AdminPatientsPanel() {
  const { t } = useAppLanguage();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try { setPatients(await api.admin.listPatients()); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleDelete(patient) {
    showConfirm({
      title: "Delete patient?",
      message: `This will permanently delete ${patient.name || patient.id} along with all their documents and extractions.`,
      danger: true,
      confirmLabel: "Delete Patient",
      onConfirm: async () => {
        try {
          await api.admin.deletePatient(patient.id);
          toast("Patient deleted");
          load();
        } catch (err) {
          toast("Failed: " + err.message, "error");
        }
      },
    });
  }

  const filtered = patients.filter((p) => {
    const q = query.toLowerCase();
    return !q || (p.name?.toLowerCase().includes(q) || p.id?.includes(q) || p.phone_number?.includes(q));
  });

  const { currentPage, setCurrentPage, paginatedItems: paginatedPatients } = usePagination(filtered, 5);

  return (
    <div className="admin-panel">
      <div className="admin-panel__header">
        <h3 className="admin-panel__title">
          <Users size={15} /> {t("nav.patientDirectory")}
          <span className="admin-panel__count">{patients.length}</span>
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn--secondary" onClick={load} style={{ fontSize: 12, padding: "6px 10px" }}>
            <RefreshCw size={13} />
          </button>
          <div className="admin-search-wrap">
            <Search size={14} />
            <input
              placeholder={t("dashboard.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="admin-panel__body">
        {loading ? (
          <div className="admin-loading"><div className="pulse-ring" /><span>{t("common.loading")}</span></div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty"><User size={32} /><p>{t("common.error")}</p></div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("role.patient")}</th>
                    <th>{t("worker.demographics")}</th>
                    <th>{t("common.language")}</th>
                    <th>{t("reminders.phone")}</th>
                    <th>{t("nav.documents")}</th>
                    <th>{t("dashboard.uploadedOn")}</th>
                    <th>{t("dashboard.viewDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPatients.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name || "Unnamed"}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{p.id}</div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {p.age ? `${p.age} yr` : "—"} {p.gender ? `· ${p.gender}` : ""}
                      </td>
                      <td>
                        {p.preferred_language ? (
                          <span className="admin-badge admin-badge--doc">
                            <Globe size={10} /> {getLanguageName(p.preferred_language)}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>{p.phone_number || "—"}</td>
                      <td>
                        <span className="admin-badge admin-badge--doc">
                          <FileText size={10} /> {p.doc_count ?? 0}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <button
                          className="admin-action-btn admin-action-btn--danger admin-action-btn--sm"
                          onClick={() => handleDelete(p)}
                          title={t("admin.deletePatient")}
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={5}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---- Documents Panel ----
function AdminDocumentsPanel() {
  const { t } = useAppLanguage();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true);
    try { setDocuments(await api.admin.listDocuments()); } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleDelete(doc) {
    showConfirm({
      title: "Delete document?",
      message: `This will permanently delete "${doc.original_filename}" and all extracted data.`,
      danger: true,
      confirmLabel: "Delete Document",
      onConfirm: async () => {
        try {
          await api.deleteDocument(doc.id);
          toast("Document deleted");
          load();
        } catch (err) {
          toast("Failed: " + err.message, "error");
        }
      },
    });
  }

  const filtered = documents.filter((d) => {
    const q = query.toLowerCase();
    return !q || (d.original_filename?.toLowerCase().includes(q) || d.document_type?.toLowerCase().includes(q) || d.patient_id?.includes(q));
  });

  const { currentPage, setCurrentPage, paginatedItems: paginatedDocs } = usePagination(filtered, 5);

  return (
    <div className="admin-panel">
      <div className="admin-panel__header">
        <h3 className="admin-panel__title">
          <FileText size={15} /> All Documents
          <span className="admin-panel__count">{documents.length}</span>
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn--secondary" onClick={load} style={{ fontSize: 12, padding: "6px 10px" }}>
            <RefreshCw size={13} />
          </button>
          <div className="admin-search-wrap">
            <Search size={14} />
            <input
              placeholder={t("dashboard.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="admin-panel__body">
        {loading ? (
          <div className="admin-loading"><div className="pulse-ring" /><span>{t("common.loading")}</span></div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty"><FileText size={32} /><p>{t("worker.noDocsYet")}</p></div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{t("upload.fileName")}</th>
                    <th>{t("docDetail.type")}</th>
                    <th>{t("role.patient")} ID</th>
                    <th>{t("docDetail.uploaded")}</th>
                    <th>{t("admin.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDocs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{d.original_filename || "Unnamed"}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>{d.id}</div>
                      </td>
                      <td>
                        {d.document_type ? (
                          <span className="admin-badge admin-badge--doc">{d.document_type}</span>
                        ) : (
                          <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ink-soft)", fontFamily: "monospace" }}>
                        {d.patient_id || "—"}
                      </td>
                      <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {d.uploaded_at ? new Date(d.uploaded_at).toLocaleDateString() : "—"}
                      </td>
                      <td>
                        <div className="admin-action-group">
                          <button
                            className="admin-action-btn admin-action-btn--sm"
                            onClick={async () => {
                              try {
                                await api.downloadDocumentFile(d.id, d.original_filename || "document");
                              } catch (err) {
                                toast("Download failed: " + err.message, "error");
                              }
                            }}
                            title={t("dashboard.downloadOriginal")}
                          >
                            <Download size={12} />
                          </button>
                          <button
                            className="admin-action-btn admin-action-btn--danger admin-action-btn--sm"
                            onClick={() => handleDelete(d)}
                            title={t("common.delete")}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalItems={filtered.length}
              pageSize={5}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HEALTHCARE DATABASE SCREEN (MedlinePlus Integration)
// ---------------------------------------------------------------------------

function HealthDatabaseScreen({ role, profile, onNav, onLogout }) {
  const { t } = useAppLanguage();
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("en");
  const [popularTopics, setPopularTopics] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [searching, setSearching] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [searchSource, setSearchSource] = useState("");

  // On-demand article translation state
  const [targetLang, setTargetLang] = useState(profile?.preferred_language ? getLanguageCode(profile.preferred_language) : "hi");
  const [translating, setTranslating] = useState(false);
  const [activeTranslatedTopic, setActiveTranslatedTopic] = useState(null);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (selectedTopic) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedTopic]);

  useEffect(() => {
    let active = true;
    async function fetchPopular() {
      setLoadingPopular(true);
      try {
        const topics = await api.healthDb.getPopular("en");
        if (active) setPopularTopics(topics);
      } catch (err) {
        console.error("Failed to load popular topics", err);
      } finally {
        if (active) setLoadingPopular(false);
      }
    }
    fetchPopular();
    return () => { active = false; };
  }, []);

  async function handleSearch(e) {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await api.healthDb.search(query.trim(), "en");
      setSearchResults(res.results || []);
      setSearchSource(res.source || "");
    } catch (err) {
      toast("Search error: " + err.message, "error");
    } finally {
      setSearching(false);
    }
  }

  function handleTopicClick(topic) {
    setSelectedTopic(topic);
    setActiveTranslatedTopic(null);
  }

  function handleCloseModal() {
    setSelectedTopic(null);
    setActiveTranslatedTopic(null);
  }

  function handleClearSearch() {
    setQuery("");
    setSearchResults(null);
    setSearchSource("");
  }

  async function handleTranslateArticle(topicId, langCode) {
    if (!topicId) return;
    setTranslating(true);
    try {
      const res = await api.healthDb.translateTopic(topicId, langCode);
      setActiveTranslatedTopic(res);
      if (selectedTopic && res.title === selectedTopic.title && res.summary === selectedTopic.summary) {
        toast("Translation service limit reached. Showing English version.", "error");
      } else {
        toast(`Article translated to ${getLanguageName(langCode)}!`);
      }
    } catch (err) {
      toast("Translation error: " + err.message, "error");
    } finally {
      setTranslating(false);
    }
  }

  function getCardSnippet(topic) {
    const raw = topic.snippet || topic.summary || "";
    const clean = raw.replace(/<[^>]+>/g, "").trim();
    if (!clean) return "Click to read full topic details and guidelines.";
    if (clean.length <= 110) return clean;
    return clean.slice(0, 108) + "…";
  }

  const displayTopic = activeTranslatedTopic || selectedTopic;

  return (
    <Shell
      role={role}
      active="healthDatabase"
      onNav={onNav}
      onLogout={onLogout}
      userName={profile?.name}
      title={t("healthDb.title")}
      subtitle={t("healthDb.subtitle")}
    >
      <div className="health-db-container">
        {/* Search Bar */}
        <div className="health-db-search-card">
          <form onSubmit={handleSearch} className="health-db-search-form">
            <div className="health-db-search-input-wrap">
              <Search size={18} color="var(--teal)" />
              <input
                type="text"
                placeholder={t("healthDb.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button type="button" className="btn-icon-subtle" onClick={handleClearSearch}>
                  <X size={16} />
                </button>
              )}
            </div>

            <button type="submit" className="btn btn--primary" disabled={searching || !query.trim()}>
              {searching ? <Loader2 size={16} className="spin" /> : "Search Library"}
            </button>
          </form>

          <div className="health-db-search-hint">
            <span>💡 Popular searches:</span>
            {["Diabetes", "High Blood Pressure", "Asthma", "Pregnancy", "Anxiety"].map((term) => (
              <button
                key={term}
                type="button"
                className="chip-btn chip-btn--sm"
                onClick={() => {
                  setQuery(term);
                  setSearching(true);
                  api.healthDb.search(term, "en").then((res) => {
                    setSearchResults(res.results || []);
                    setSearchSource(res.source || "");
                    setSearching(false);
                  });
                }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* SEARCH RESULTS VIEW */}
        {searchResults !== null && (
          <div className="health-db-results-section">
            <div className="health-db-results-header">
              <h2 style={{ margin: 0, fontSize: 18 }}>
                Search Results for "{query}"
                <span className="results-count-badge" style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: "var(--ink-soft)" }}>
                  ({searchResults.length} topics)
                </span>
              </h2>
              {searchSource && (
                <span className="badge badge--teal">
                  <ShieldCheck size={12} style={{ marginRight: 4 }} /> {searchSource === "cache" ? "Instant Cache" : "MedlinePlus Web Service"}
                </span>
              )}
            </div>

            {searchResults.length === 0 ? (
              <div className="empty-state">
                <FileText size={36} color="var(--ink-faint)" />
                <p>No health topics found matching "{query}". Try a different keyword.</p>
              </div>
            ) : (
              <div className="health-db-grid">
                {searchResults.map((topic, i) => (
                  <div key={topic.id || i} className="health-topic-card" onClick={() => handleTopicClick(topic)}>
                    <div className="health-topic-card__header">
                      <h3 className="health-topic-title">{topic.title}</h3>
                      <span className="badge badge--sage">MedlinePlus</span>
                    </div>

                    <p className="health-topic-snippet">
                      {getCardSnippet(topic)}
                    </p>

                    {topic.groups && topic.groups.length > 0 && (
                      <div className="health-topic-groups">
                        {topic.groups.slice(0, 2).map((g, idx) => (
                          <span key={idx} className="topic-group-tag">{g}</span>
                        ))}
                      </div>
                    )}

                    <div className="health-topic-card__footer">
                      <span className="topic-org-label">{topic.organization || "National Library of Medicine"}</span>
                      <button type="button" className="btn-link" style={{ background: "none", border: "none", color: "var(--teal)", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
                        Read Topic <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* POPULAR TOPICS LANDING GRID */}
        {searchResults === null && (
          <div className="health-db-popular-section">
            <div className="health-db-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>{t("healthDb.popularTopics")}</h2>
                <p className="section-sub" style={{ margin: "2px 0 0", color: "var(--ink-soft)", fontSize: 13 }}>
                  Essential healthcare guidelines curated from MedlinePlus
                </p>
              </div>
            </div>

            {loadingPopular ? (
              <div className="loading-box" style={{ padding: 40 }}>
                <div className="pulse-ring" />
                <p style={{ color: "var(--ink-soft)", margin: 0 }}>{t("healthDb.loadingTopics")}</p>
              </div>
            ) : (
              <div className="health-db-grid">
                {popularTopics.map((topic, i) => (
                  <div key={topic.id || i} className="health-topic-card" onClick={() => handleTopicClick(topic)}>
                    <div className="health-topic-card__header">
                      <h3 className="health-topic-title">{topic.title}</h3>
                      <span className="badge badge--teal">{t("healthDb.verified")}</span>
                    </div>

                    <p className="health-topic-snippet">
                      {getCardSnippet(topic)}
                    </p>

                    {topic.groups && topic.groups.length > 0 && (
                      <div className="health-topic-groups">
                        {topic.groups.slice(0, 2).map((g, idx) => (
                          <span key={idx} className="topic-group-tag">{g}</span>
                        ))}
                      </div>
                    )}

                    <div className="health-topic-card__footer">
                      <span className="topic-org-label">{t("healthDb.medlinePlus") || "MedlinePlus / NLM"}</span>
                      <button type="button" className="btn-link" style={{ background: "none", border: "none", color: "var(--teal)", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>
                        {t("healthDb.readFull")} <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TOPIC DETAIL MODAL */}
        {selectedTopic && displayTopic && (
          <div className="modal-backdrop" onClick={handleCloseModal}>
            <div
              className="modal-card health-topic-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 680, width: "90%", maxHeight: "85vh", display: "flex", flexDirection: "column" }}
            >
              {/* Header with Title & Prominent Close (X) Button */}
              <div className="health-topic-modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 12, borderBottom: "1px solid var(--border-soft)" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
                    <span className="badge badge--teal">
                      <ShieldCheck size={12} style={{ marginRight: 3 }} /> MedlinePlus Verified
                    </span>
                    {activeTranslatedTopic ? (
                      <span className="badge badge--gold">
                        Translated ({getLanguageName(activeTranslatedTopic.language)})
                      </span>
                    ) : (
                      <span className="badge badge--paper">{t("healthDb.englishOriginal")}</span>
                    )}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 20, color: "var(--ink)" }}>{displayTopic.title}</h2>
                </div>

                <button
                  type="button"
                  className="modal-close-cross-btn"
                  onClick={handleCloseModal}
                  title="Close Article (Esc)"
                  aria-label="Close article"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Translation Toolbar at top of article */}
              <div className="topic-translate-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: 10, margin: "12px 0 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Globe size={15} color="var(--teal)" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t("healthDb.translateTo")}</span>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--panel)", color: "var(--ink)" }}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={translating}
                    onClick={() => handleTranslateArticle(selectedTopic.id, targetLang)}
                    style={{ fontSize: 12 }}
                  >
                    {translating ? <Loader2 size={13} className="spin" /> : "Translate Article"}
                  </button>

                  {activeTranslatedTopic && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setActiveTranslatedTopic(null)}
                      style={{ fontSize: 12 }}
                    >
                      Show Original (English)
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Body Only */}
              <div className="health-topic-modal__body" style={{ overflowY: "auto", flex: 1, paddingRight: 4 }}>
                {displayTopic.summary && (
                  <div className="topic-summary-box" style={{ background: "var(--panel)", padding: 18, border: "1px solid var(--border-soft)", borderRadius: "var(--radius-m)", marginBottom: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--teal)", fontWeight: 600 }}>Medical Summary & Guidelines</h4>
                    <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, margin: 0, fontSize: 14, color: "var(--ink)" }}>{displayTopic.summary}</p>
                  </div>
                )}

                {displayTopic.snippet && !displayTopic.summary && (
                  <div className="topic-summary-box" style={{ background: "var(--panel)", padding: 18, border: "1px solid var(--border-soft)", borderRadius: "var(--radius-m)", marginBottom: 16 }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--teal)", fontWeight: 600 }}>{t("healthDb.keyHighlights")}</h4>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--ink)", lineHeight: 1.6 }}>{displayTopic.snippet}</p>
                  </div>
                )}

                {displayTopic.groups && displayTopic.groups.length > 0 && (
                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <h4 style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 6px" }}>Categories & Health Groups</h4>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {displayTopic.groups.map((g, idx) => (
                        <span key={idx} className="topic-group-tag" style={{ fontSize: 12, padding: "4px 10px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12 }}>{g}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fixed Footer */}
              <div className="topic-modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, marginTop: 12, borderTop: "1px solid var(--border-soft)" }}>
                <div className="topic-org-info" style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                  <strong>{t("healthDb.sourceAuthority")}</strong> {displayTopic.organization || "U.S. National Library of Medicine (MedlinePlus)"}
                </div>
                {selectedTopic.url && (
                  <a
                    href={selectedTopic.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--secondary btn--sm"
                    style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    View on MedlinePlus.gov <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}


// ---------------------------------------------------------------------------
// MEDICATION REMINDERS SCREEN
// ---------------------------------------------------------------------------

function RemindersScreen({ role, profile, onNav, onLogout, prefilledReminder, clearPrefilledReminder }) {
  const { t } = useAppLanguage();
  const [reminders, setReminders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [medicineName, setMedicineName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [time1, setTime1] = useState("08:00");
  const [time2, setTime2] = useState("20:00");
  const [useSecondTime, setUseSecondTime] = useState(false);
  const [patientPhone, setPatientPhone] = useState(profile?.phone_number || "");
  const [caregiverName, setCaregiverName] = useState(profile?.emergency_contact || "");
  const [caregiverPhone, setCaregiverPhone] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [documentId, setDocumentId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rems, lg] = await Promise.all([
        api.reminders.list(),
        api.reminders.getLogs(),
      ]);
      setReminders(rems);
      setLogs(lg);
    } catch (err) {
      toast("Error loading reminders: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (prefilledReminder) {
      setMedicineName(prefilledReminder.medicine_name || "");
      setDosage(prefilledReminder.dosage || "");
      if (prefilledReminder.document_id) setDocumentId(prefilledReminder.document_id);
      setShowModal(true);
      if (clearPrefilledReminder) clearPrefilledReminder();
    }
  }, [prefilledReminder, clearPrefilledReminder]);

  async function handleCreateReminder(e) {
    e.preventDefault();
    if (!medicineName.trim()) {
      toast("Please enter medicine name", "error");
      return;
    }
    const times = [time1];
    if (useSecondTime && time2) times.push(time2);

    setSubmitting(true);
    try {
      await api.reminders.create({
        medicine_name: medicineName.trim(),
        dosage: dosage.trim(),
        times,
        frequency,
        patient_phone: patientPhone.trim(),
        caregiver_name: caregiverName.trim(),
        caregiver_phone: caregiverPhone.trim(),
        start_date: startDate,
        end_date: endDate || null,
        document_id: documentId || null,
      });
      toast("Medication reminder created successfully!");
      setShowModal(false);
      setMedicineName("");
      setDosage("");
      loadData();
    } catch (err) {
      toast("Failed to create reminder: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMarkTaken(logId) {
    try {
      await api.reminders.markTaken(logId);
      toast("Medication marked as TAKEN! Great job staying on schedule.");
      loadData();
    } catch (err) {
      toast("Failed to update status: " + err.message, "error");
    }
  }

  async function handleSnooze(logId) {
    try {
      await api.reminders.snooze(logId, 15);
      toast("Reminder snoozed for 15 minutes.");
      loadData();
    } catch (err) {
      toast("Failed to snooze: " + err.message, "error");
    }
  }

  async function handleDeleteReminder(reminderId) {
    showConfirm({
      title: "Delete Reminder Schedule?",
      message: "This will remove the schedule and stop SMS notifications. Are you sure?",
      danger: true,
      confirmLabel: "Delete Schedule",
      onConfirm: async () => {
        try {
          await api.reminders.delete(reminderId);
          toast("Reminder schedule deleted.");
          loadData();
        } catch (err) {
          toast("Failed to delete: " + err.message, "error");
        }
      },
    });
  }

  const takenCount = logs.filter((l) => l.status === "taken").length;
  const missedCount = logs.filter((l) => l.status === "missed").length;

  return (
    <Shell
      role={role}
      active="reminders"
      onNav={onNav}
      onLogout={onLogout}
      userName={profile?.name}
      title={t("reminders.title")}
      subtitle={t("reminders.subtitle")}
    >
      <div className="health-db-container">
        {/* Top Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
          <div style={{ background: "var(--panel)", padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(42, 157, 143, 0.12)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Pill size={22} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{reminders.length}</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("reminders.activeReminders")}</div>
            </div>
          </div>

          <div style={{ background: "var(--panel)", padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(46, 204, 113, 0.12)", color: "#27ae60", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{takenCount}</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("reminders.taken")}</div>
            </div>
          </div>

          <div style={{ background: "var(--panel)", padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: missedCount > 0 ? "rgba(192, 57, 43, 0.12)" : "rgba(241, 196, 15, 0.12)", color: missedCount > 0 ? "var(--brick)" : "#f39c12", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: missedCount > 0 ? "var(--brick)" : "var(--ink)" }}>{missedCount}</div>
              <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{t("reminders.missed")}</div>
            </div>
          </div>

          <div style={{ background: "var(--panel)", padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border-soft)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(52, 152, 219, 0.12)", color: "#2980b9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("reminders.caregiverAlertsActive")}</div>
              <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{t("reminders.autoSMSDescription")}</div>
            </div>
          </div>
        </div>

        {/* Section Header with Add Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 20, margin: 0, color: "var(--ink)" }}>{t("reminders.todaySchedule")}</h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0" }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> {t("reminders.scheduleBtn")}
          </button>
        </div>

        {/* Today's Dose Logs Timeline */}
        {loading ? (
          <div className="loading-box" style={{ padding: 30 }}>
            <Loader2 size={24} className="spin" color="var(--teal)" />
            <p style={{ margin: "10px 0 0", color: "var(--ink-soft)" }}>{t("common.loading")}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="empty-state" style={{ background: "var(--panel)", padding: 36, borderRadius: 12, border: "1px dashed var(--border)", textAlign: "center" }}>
            <AlarmClock size={36} color="var(--teal)" style={{ marginBottom: 12 }} />
            <h3 style={{ margin: 0, fontSize: 16 }}>{t("reminders.noActive")}</h3>
            <p style={{ color: "var(--ink-soft)", fontSize: 13, maxWidth: 450, margin: "8px auto 16px" }}>
              {t("reminders.scheduleBtn")}
            </p>
            <button className="btn btn--secondary" onClick={() => setShowModal(true)}>
              <Plus size={15} /> {t("reminders.scheduleBtn")}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 }}>
            {logs.map((log) => {
              let timeFmt = "";
              if (log.scheduled_time) {
                const parts = log.scheduled_time.split("T");
                if (parts.length === 2) {
                  const rawTime = parts[1].replace("Z", "").slice(0, 5);
                  const [hh, mm] = rawTime.split(":");
                  let hour = parseInt(hh, 10);
                  if (!isNaN(hour)) {
                    const ampm = hour >= 12 ? "PM" : "AM";
                    hour = hour % 12 || 12;
                    timeFmt = `${hour}:${mm} ${ampm}`;
                  }
                }
                if (!timeFmt) {
                  timeFmt = new Date(log.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              }
              return (
                <div
                  key={log.id}
                  style={{
                    background: "var(--panel)",
                    border: `1px solid ${
                      log.status === "taken"
                        ? "rgba(46, 204, 113, 0.3)"
                        : log.status === "missed"
                        ? "rgba(192, 57, 43, 0.3)"
                        : "var(--border-soft)"
                    }`,
                    borderRadius: 12,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "var(--bg-subtle)",
                        fontWeight: 700,
                        fontSize: 14,
                        color: "var(--ink)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Clock size={15} color="var(--teal)" /> {timeFmt}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: "var(--ink)" }}>{log.medicine_name}</div>
                      <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 2 }}>{log.dosage || "As prescribed"}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {log.status === "taken" ? (
                      <span className="badge badge--teal" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={14} /> {t("reminders.taken")} {log.action_time ? new Date(log.action_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                      </span>
                    ) : log.status === "missed" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className="badge" style={{ background: "rgba(192, 57, 43, 0.12)", color: "var(--brick)", padding: "6px 12px", fontSize: 12 }}>
                          <AlertCircle size={14} style={{ marginRight: 4 }} /> {t("reminders.missed")}
                        </span>
                        {log.notified_caregiver === 1 && (
                          <span style={{ fontSize: 11, color: "var(--brick)", fontWeight: 500 }}>
                            📢 Caregiver Notified
                          </span>
                        )}
                        <button className="btn btn--secondary btn--sm" onClick={() => handleMarkTaken(log.id)} style={{ fontSize: 12 }}>
                          {t("reminders.markTaken")}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button className="btn btn--primary btn--sm" onClick={() => handleMarkTaken(log.id)} style={{ fontSize: 12 }}>
                          <CheckCircle2 size={14} /> {t("reminders.markTaken")}
                        </button>
                        <button className="btn btn--secondary btn--sm" onClick={() => handleSnooze(log.id)} style={{ fontSize: 12 }}>
                          <Clock size={13} /> {t("reminders.snooze15")}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Active Schedules Section */}
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontSize: 18, color: "var(--ink)", marginBottom: 14 }}>{t("reminders.activeReminders")}</h3>

          {reminders.length === 0 ? (
            <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t("reminders.noActive")}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {reminders.map((rem) => (
                <div key={rem.id} style={{ background: "var(--panel)", padding: 20, borderRadius: 12, border: "1px solid var(--border-soft)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <h4 style={{ margin: 0, fontSize: 17, color: "var(--ink)" }}>{rem.medicine_name}</h4>
                      <span className="badge badge--gold" style={{ fontSize: 11 }}>{rem.frequency}</span>
                    </div>

                    <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" }}>
                      {t("reminders.dosage")}: <strong>{rem.dosage || t("reminders.scheduled")}</strong>
                    </p>

                    <div style={{ fontSize: 12, color: "var(--ink)", background: "var(--bg-subtle)", padding: "8px 12px", borderRadius: 8, marginBottom: 12 }}>
                      ⏰ Scheduled Times: <strong>{Array.isArray(rem.times) ? rem.times.join(", ") : rem.times}</strong>
                    </div>

                    {rem.patient_phone && (
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>
                        📱 Patient Phone: {rem.patient_phone}
                      </div>
                    )}

                    {rem.caregiver_phone && (
                      <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>
                        🚨 Caregiver: <strong>{rem.caregiver_name || "Assigned"}</strong> ({rem.caregiver_phone})
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
                    <button className="btn btn--secondary btn--sm" onClick={() => handleDeleteReminder(rem.id)} style={{ color: "var(--brick)", fontSize: 12 }}>
                      <Trash2 size={13} /> Remove Schedule
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal: Schedule New Reminder */}
        {showModal && (
          <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 16 }}>
            <div style={{ background: "var(--panel)", borderRadius: 16, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlarmClock size={20} color="var(--teal)" /> {t("reminders.scheduleBtn")}
                </h3>
                <button type="button" onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)" }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateReminder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>{t("reminders.medicineName")} *</label>
                  <input
                    type="text"
                    required
                    value={medicineName}
                    onChange={(e) => setMedicineName(e.target.value)}
                    placeholder="e.g. Paracetamol, Metformin"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--ink)" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>{t("reminders.dosage")}</label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 500mg after meal"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--ink)" }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>{t("reminders.times")} 1 *</label>
                    <input
                      type="time"
                      required
                      value={time1}
                      onChange={(e) => setTime1(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--ink)" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>{t("reminders.times")} 2</label>
                    {useSecondTime ? (
                      <input
                        type="time"
                        value={time2}
                        onChange={(e) => setTime2(e.target.value)}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--ink)" }}
                      />
                    ) : (
                      <button type="button" className="btn btn--secondary" onClick={() => setUseSecondTime(true)} style={{ width: "100%", fontSize: 12, height: 42 }}>
                        + Add 2nd Time
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--ink)" }}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                <div style={{ background: "var(--bg-subtle)", padding: 14, borderRadius: 10, border: "1px solid var(--border-soft)", marginTop: 4 }}>
                  <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "var(--teal)", display: "flex", alignItems: "center", gap: 6 }}>
                    <Phone size={14} /> Twilio SMS & Caregiver Notification Setup
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 2 }}>{t("reminders.phone")}</label>
                      <input
                        type="tel"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="+15005550006"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--panel)", color: "var(--ink)" }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 2 }}>{t("reminders.caregiverName")}</label>
                      <input
                        type="text"
                        value={caregiverName}
                        onChange={(e) => setCaregiverName(e.target.value)}
                        placeholder="e.g. Son / Doctor"
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--panel)", color: "var(--ink)" }}
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: "block", fontSize: 11, color: "var(--ink-soft)", marginBottom: 2 }}>{t("reminders.caregiverPhone")}</label>
                    <input
                      type="tel"
                      value={caregiverPhone}
                      onChange={(e) => setCaregiverPhone(e.target.value)}
                      placeholder="+15005550006"
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--panel)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
                  <button type="button" className="btn btn--secondary" onClick={() => setShowModal(false)}>
                    {t("common.cancel")}
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={submitting}>
                    {submitting ? <Loader2 size={16} className="spin" /> : t("common.save")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}


// ---------------------------------------------------------------------------
// ROOT APP COMPONENT
// ---------------------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState("patient");
  const [screen, setScreen] = useState("landing");
  const [activePatient, setActivePatient] = useState(null);
  const [activeDocId, setActiveDocId] = useState(null);
  const [prefilledReminder, setPrefilledReminder] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  // Global App Language State
  const [appLanguage, setAppLanguageState] = useState(() => {
    return localStorage.getItem("sehat_saathi_lang") || "hi";
  });

  function changeAppLanguage(newLang) {
    setAppLanguageState(newLang);
    localStorage.setItem("sehat_saathi_lang", newLang);
  }

  // Restore authenticated session on mount
  useEffect(() => {
    async function restoreSession() {
      const token = getToken();
      if (!token) {
        setBootstrapping(false);
        return;
      }
      try {
        const res = await api.getMe();
        setUser(res.user);
        setProfile(res.profile);
        setRole(res.user.role || "patient");
        setScreen("dashboard");

        // Sync user preferred language if available
        if (res.profile?.preferred_language) {
          const userLangCode = getLanguageCode(res.profile.preferred_language);
          setAppLanguageState(userLangCode);
          localStorage.setItem("sehat_saathi_lang", userLangCode);
        }
      } catch (err) {
        console.warn("Session restore failed, clearing token", err);
        clearToken();
      } finally {
        setBootstrapping(false);
      }
    }
    restoreSession();
  }, []);

  function handleLoginSuccess(userRecord, profileRecord) {
    setUser(userRecord);
    setProfile(profileRecord);
    setRole(userRecord.role || "patient");
    setScreen("dashboard");
  }

  function handleLogout() {
    api.logout();
    setUser(null);
    setProfile(null);
    setScreen("landing");
  }

  function goTo(key, payload = null) {
    if (key === "login") {
      handleLogout();
      return;
    }
    if (payload) {
      setPrefilledReminder(payload);
    }
    if (role === "patient" && key === "patientDetail") key = "dashboard";
    if (role === "healthcare_worker" && key === "profile") key = "dashboard";
    setScreen(key);
  }

  if (bootstrapping) {
    return (
      <div className="ss-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center" }}>
          <div className="pulse-ring" style={{ margin: "0 auto 16px" }} />
          <BrandMark />
          <p style={{ color: "var(--ink-soft)", marginTop: 8 }}>{translate("common.connecting", appLanguage)}</p>
        </div>
      </div>
    );
  }

  let body;
  if (screen === "landing") {
    body = (
      <LandingScreen
        onGoLogin={() => setScreen("login")}
        onGoRegister={() => setScreen("register")}
      />
    );
  } else if (screen === "login") {
    body = (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onGoRegister={() => setScreen("register")}
        onGoLanding={() => setScreen("landing")}
      />
    );
  } else if (screen === "register") {
    body = (
      <RegisterScreen
        onRegisterSuccess={handleLoginSuccess}
        onGoLogin={() => setScreen("login")}
        onGoLanding={() => setScreen("landing")}
      />
    );
  } else if (screen === "dashboard" && role === "patient") {
    body = (
      <PatientDashboard
        patient={profile || { name: user?.name, id: user?.patient_id }}
        onNav={goTo}
        onOpenDocument={(docId) => {
          setActiveDocId(docId);
          setScreen("documentDetail");
        }}
        onLogout={handleLogout}
      />
    );
  } else if (screen === "dashboard" && role === "healthcare_worker") {
    body = (
      <WorkerDashboard
        user={user}
        profile={profile}
        onNav={goTo}
        onOpenPatient={(p) => {
          setActivePatient(p);
          setScreen("patientDetail");
        }}
        onOpenDocument={(docId) => {
          setActiveDocId(docId);
          setScreen("documentDetail");
        }}
        onLogout={handleLogout}
      />
    );
  } else if (screen === "dashboard" && role === "admin") {
    body = (
      <AdminDashboard
        user={user}
        onLogout={handleLogout}
      />
    );
  } else if (screen === "healthDatabase") {
    body = (
      <HealthDatabaseScreen
        role={role}
        profile={profile}
        onNav={goTo}
        onLogout={handleLogout}
      />
    );
  } else if (screen === "reminders") {
    body = (
      <RemindersScreen
        role={role}
        profile={profile}
        onNav={goTo}
        onLogout={handleLogout}
        prefilledReminder={prefilledReminder}
        clearPrefilledReminder={() => setPrefilledReminder(null)}
      />
    );
  } else if (screen === "upload") {
    body = (
      <UploadScreen
        role={role}
        currentPatient={role === "healthcare_worker" ? activePatient : profile}
        onNav={goTo}
        onUploaded={(newDocId) => {
          setActiveDocId(newDocId);
          setScreen("documentDetail");
        }}
        onLogout={handleLogout}
      />
    );
  } else if (screen === "documentDetail") {
    body = (
      <DocumentDetailScreen
        role={role}
        documentId={activeDocId}
        onNav={goTo}
        onBack={() => setScreen(role === "healthcare_worker" && activePatient ? "patientDetail" : "dashboard")}
        onLogout={handleLogout}
      />
    );
  } else if (screen === "profile") {
    body = (
      <ProfileScreen
        user={user}
        patient={profile || { name: user?.name, id: user?.patient_id }}
        onNav={goTo}
        onLogout={handleLogout}
        onProfileUpdated={(updated) => setProfile(updated)}
      />
    );
  } else if (screen === "emergency") {
    body = (
      <EmergencyScreen
        role={role}
        patientProfile={profile}
        onNav={goTo}
        onLogout={handleLogout}
      />
    );
  } else if (screen === "patientDetail") {
    body = (
      <WorkerPatientDetail
        patient={activePatient}
        onNav={goTo}
        onBack={() => setScreen("dashboard")}
        onUploadFor={(p) => {
          setActivePatient(p);
          setScreen("upload");
        }}
        onOpenDocument={(docId) => {
          setActiveDocId(docId);
          setScreen("documentDetail");
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <LanguageContext.Provider
      value={{
        language: appLanguage,
        setLanguage: changeAppLanguage,
        t: (key) => translate(key, appLanguage),
      }}
    >
      <div className="ss-root">
        <GlobalModals />
        <PageTransition key={screen + (role || "")}>
          {body}
        </PageTransition>
      </div>
    </LanguageContext.Provider>
  );
}

