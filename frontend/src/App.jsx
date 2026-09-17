import React, { useState, useEffect, useRef, useCallback } from "react";
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
} from "lucide-react";
import { api, getToken, clearToken } from "./api";

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

// Supported languages matching pipeline codes
const LANGUAGES = [
  { code: "hi", name: "Hindi" },
  { code: "en", name: "English" },
  { code: "bn", name: "Bengali" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "mr", name: "Marathi" },
  { code: "gu", name: "Gujarati" },
  { code: "kn", name: "Kannada" },
  { code: "pa", name: "Punjabi" },
  { code: "ur", name: "Urdu" },
];

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
// SHARED PIECES
// ---------------------------------------------------------------------------

function BrandMark({ light, onClick }) {
  return (
    <span
      className="ss-wordmark"
      onClick={onClick}
      style={{
        color: light ? "#EFEAD9" : "var(--ink)",
        fontSize: 20,
        cursor: onClick ? "pointer" : "inherit"
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
      title="Copy to clipboard"
    >
      {copied ? <Check size={13} strokeWidth={2.5} /> : <Copy size={13} strokeWidth={2} />}
      <span>{copied ? "Copied" : "Copy"}</span>
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
          <span className="pwd-strength-title">Password Strength:</span>
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
      badge: "AI Extraction",
      title: "Prescription & Report OCR",
      text: "Scan or upload any handwritten or printed prescription, diagnostic report, or discharge summary. Our system extracts medicine names, dosages, and diagnostic insights instantly.",
      icon: <FileText size={20} />,
      imageSrc: "/images/landing-ocr.jpg",
      tags: ["Prescriptions", "Lab Reports", "Discharge Summaries"],
    },
    {
      id: "simplify",
      badge: "Plain Language",
      title: "Medical Jargon Translator",
      text: "Complex medical terms like '1-0-1' or 'antipyretic' are simplified into plain language instructions so patients and families know exactly what to do and when.",
      icon: <CheckCircle2 size={20} />,
      imageSrc: "/images/landing-simplify.jpg",
      tags: ["Clear Terms", "Dosage Instructions", "Patient-Friendly"],
    },
    {
      id: "audio",
      badge: "Voice & Audio",
      title: "Spoken Regional Audio",
      text: "Listen to prescription explanations spoken naturally in native regional languages including Hindi, Tamil, Telugu, Marathi, and Gujarati for maximum accessibility.",
      icon: <Volume2 size={20} />,
      imageSrc: "/images/landing-audio.jpg",
      tags: ["Text-to-Speech", "Native Dialects", "Accessible Audio"],
    },
    {
      id: "portal",
      badge: "Healthcare Staff",
      title: "Community Worker Portal",
      text: "Equip clinic staff and ASHA workers to manage patient records, upload documents on behalf of patients, and inspect AI processing pipelines seamlessly.",
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
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#about">About</a></li>
        </ul>
        <div className="landing-nav__actions">
          <button className="btn btn--secondary" onClick={onGoLogin} style={{ padding: "8px 16px", fontSize: 13 }}>
            Log in
          </button>
          <button className="btn btn--primary" onClick={onGoRegister} style={{ padding: "8px 18px", fontSize: 13 }}>
            Get started <ArrowLeft size={14} style={{ transform: "rotate(180deg)", verticalAlign: "middle", marginLeft: 4 }} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div>
          <div className="landing-hero__badge">
            <Sparkles size={14} /> AI-Powered Health Assistance
          </div>
          <h1 className="landing-hero__title">
            Medical prescriptions & reports, <span>simplified in your language.</span>
          </h1>
          <p className="landing-hero__subtitle">
            Upload any medical prescription, report, or discharge summary and receive instant plain-language explanations and spoken audio in local languages.
          </p>
          <div className="landing-hero__cta">
            <button className="btn btn--primary" onClick={onGoRegister} style={{ padding: "12px 24px", fontSize: 15 }}>
              Get started now
            </button>
            <button className="btn btn--secondary" onClick={onGoLogin} style={{ padding: "12px 20px", fontSize: 15 }}>
              Log in to your account
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
              <h4>Smart Extraction</h4>
              <p>Handwritten & printed OCR</p>
            </div>
          </div>
          <div className="landing-trust-item">
            <div className="landing-trust-icon"><Globe size={20} /></div>
            <div className="landing-trust-text">
              <h4>Multi-lingual</h4>
              <p>10+ Indian regional languages</p>
            </div>
          </div>
          <div className="landing-trust-item">
            <div className="landing-trust-icon"><Volume2 size={20} /></div>
            <div className="landing-trust-text">
              <h4>Audio Assistance</h4>
              <p>Natural text-to-speech audio</p>
            </div>
          </div>
          <div className="landing-trust-item">
            <div className="landing-trust-icon"><ShieldCheck size={20} /></div>
            <div className="landing-trust-text">
              <h4>Verified Access</h4>
              <p>Patient & Worker portals</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll-Unfolding Features Section */}
      <section id="features" className="landing-section">
        <div className="landing-section__header">
          <span className="landing-section__badge">Key Capabilities</span>
          <h2 className="landing-section__title">Designed for Patients & Healthcare Workers</h2>
          <p className="landing-section__subtitle">
            Explore how Sehat Saathi bridges language barriers and medical complexity with cutting-edge AI.
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
                <div className="unfold-card__tags">
                  {f.tags.map((t) => (
                    <span key={t} className="badge badge--teal" style={{ background: "var(--paper-deep)", color: "var(--ink-soft)" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="landing-section" style={{ background: "var(--panel)", borderTop: "1px solid var(--border-soft)" }}>
        <div className="landing-section__header">
          <span className="landing-section__badge">Simple 3-Step Process</span>
          <h2 className="landing-section__title">How Sehat Saathi Works</h2>
          <p className="landing-section__subtitle">
            From document capture to translated audio explanations in seconds.
          </p>
        </div>

        <div className="workflow-grid">
          <div className="workflow-card">
            <div className="workflow-card__number">1</div>
            <h3 className="workflow-card__title">Upload Document</h3>
            <p className="workflow-card__text">
              Snap a photo with your device camera or upload a PDF/Image of your prescription or diagnostic report.
            </p>
          </div>
          <div className="workflow-card">
            <div className="workflow-card__number">2</div>
            <h3 className="workflow-card__title">AI Extraction</h3>
            <p className="workflow-card__text">
              Our vision AI analyzes raw text, identifies medication names, dosage timings, and translates key insights.
            </p>
          </div>
          <div className="workflow-card">
            <div className="workflow-card__number">3</div>
            <h3 className="workflow-card__title">Read or Listen</h3>
            <p className="workflow-card__text">
              View simplified bullet points in your preferred language or tap to hear natural spoken audio playback.
            </p>
          </div>
        </div>

        {/* CTA Banner */}
        <div id="about" className="landing-cta-banner">
          <h2>Ready to simplify your medical prescriptions?</h2>
          <p>
            Join thousands of patients and healthcare staff making medical records clear and accessible to everyone.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn btn--primary" onClick={onGoRegister} style={{ padding: "12px 28px", fontSize: 15 }}>
              Create a free account
            </button>
            <button className="btn btn--secondary" onClick={onGoLogin} style={{ padding: "12px 24px", fontSize: 15, background: "rgba(255,255,255,0.15)", color: "#FFFFFF", borderColor: "rgba(255,255,255,0.3)" }}>
              Log in
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
          Sehat Saathi — Empowering healthcare comprehension across regional India.
        </p>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AUTH SCREENS
// ---------------------------------------------------------------------------

function LoginScreen({ onLoginSuccess, onGoRegister, onGoLanding }) {
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
        const roleNames = { patient: "Patient", healthcare_worker: "Health worker", admin: "Admin" };
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
          <h2>Medical documents, explained in your own language.</h2>
          <p>
            Upload a prescription or discharge summary and get it back simplified
            and translated — so the people relying on it can actually understand it.
          </p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card">
          <h1>Log in</h1>
          <p className="lead">Welcome back. Enter your credentials to sign in.</p>

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
              Patient
            </button>
            <button
              type="button"
              className={role === "healthcare_worker" ? "active" : ""}
              onClick={() => setRole("healthcare_worker")}
            >
              Health worker
            </button>
            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => setRole("admin")}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <Field label="Email address">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <PasswordField
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <button type="submit" className="btn btn--primary btn--block" disabled={loading} style={{ marginTop: 12 }}>
              {loading ? <span className="spinner" /> : "Log in"}
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
          <h2>Built for the person who has to explain the prescription twice.</h2>
          <p>
            Whether you're a patient managing your own care or a health worker
            supporting several families, your documents and their history stay
            in one place.
          </p>
        </div>
      </div>
      <div className="auth-form-side">
        <div className="auth-card" style={{ maxWidth: 420 }}>
          <h1>Create an account</h1>
          <p className="lead">It takes about a minute.</p>

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
              Patient
            </button>
            <button
              type="button"
              className={role === "healthcare_worker" ? "active" : ""}
              onClick={() => setRole("healthcare_worker")}
            >
              Health worker
            </button>
            <button
              type="button"
              className={role === "admin" ? "active" : ""}
              onClick={() => setRole("admin")}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <Field label="Full name">
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Email address">
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <PasswordField
              label="Create password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              hint="Must be at least 8 characters"
            />
            <PasswordStrengthIndicator password={password} />

            {role === "patient" ? (
              <>
                <div className="field-row">
                  <Field label="Age">
                    <input
                      type="number"
                      placeholder="34"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                    />
                  </Field>
                  <Field label="Gender">
                    <select value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </Field>
                </div>
                <Field label="Phone number">
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <Field label="Preferred language" hint="Documents will be translated into this language by default">
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
                label="Admin Invite Code"
                hint="System administrator authorization code."
              >
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="ADMIN-..."
                  required
                />
              </Field>
            ) : (
              <>
                <Field
                  label="Healthcare Worker Invite Code"
                  hint="Hospital authorization code required to verify staff credentials."
                >
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="HOSPITAL-..."
                    required
                  />
                </Field>
                <div className="field-row">
                  <Field label="Employee ID">
                    <input
                      type="text"
                      placeholder="e.g. EMP-1024"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                    />
                  </Field>
                  <Field label="Department">
                    <input
                      type="text"
                      placeholder="e.g. Community Health"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Contact Phone">
                  <input
                    type="tel"
                    placeholder="e.g. 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </>
            )}

            <button type="submit" className="btn btn--primary btn--block" disabled={loading} style={{ marginTop: 12 }}>
              {loading ? <span className="spinner" /> : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account?{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); onGoLogin(); }} style={{ color: "var(--teal)", fontWeight: 600 }}>
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// APP SHELL
// ---------------------------------------------------------------------------

function Shell({ role, active, onNav, onLogout, title, subtitle, children, userName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const patientNav = [
    { key: "dashboard", label: "Your documents", icon: Home },
    { key: "upload", label: "Upload a document", icon: UploadCloud },
    { key: "profile", label: "Your profile", icon: User },
  ];
  const workerNav = [
    { key: "dashboard", label: "Patient Directory", icon: Users },
    { key: "upload", label: "Upload Document", icon: UploadCloud },
  ];
  const adminNav = [
    { key: "overview", label: "Overview", icon: LayoutDashboard },
    { key: "users", label: "Users", icon: UserCog },
    { key: "patients", label: "Patients", icon: Users },
    { key: "documents", label: "Documents", icon: FileText },
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
        <div className="mobile-topbar__actions">
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
                  {role === "healthcare_worker" ? "Healthcare Worker" : role === "admin" ? "Administrator" : "Patient"}
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
            Log out
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
            <button
              type="button"
              className="btn btn--secondary mobile-logout-btn"
              onClick={onLogout}
              title="Log out"
            >
              <LogOut size={15} strokeWidth={2} />
              <span>Log out</span>
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
          title="Previous page"
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
          title="Next page"
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
      userName={patient?.name || "Patient"}
      title={`Welcome back, ${patientName}`}
      subtitle="Here are your uploaded medical records, simplified prescriptions, and translations."
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", lineHeight: 1.2 }}>Your documents ({documents.length})</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
                {documents.length > 0 && (
                  <div className="search-bar" style={{ flex: "1 1 140px", minWidth: 0, maxWidth: 280, margin: 0, height: 34, boxSizing: "border-box" }}>
                    <Search size={14} style={{ flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Search records…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
                <button className="btn btn--secondary" onClick={loadDocs} style={{ height: 34, padding: "0 12px", fontSize: 13, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, boxSizing: "border-box" }}>
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>
            </div>

            {loading ? (
              <div className="loading-box">
                <div className="pulse-ring" />
                <p style={{ color: "var(--ink-soft)", margin: 0 }}>Loading your medical records...</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="empty-state">
                <FileText size={36} color="var(--ink-faint)" />
                <h3>{searchQuery ? "No matching records found" : "No documents uploaded yet"}</h3>
                <p>{searchQuery ? "Try searching with a different term." : "Upload a prescription, discharge summary, or report to get an easy explanation in your language."}</p>
                <button className="btn btn--primary" onClick={() => onNav("upload")}>
                  <Plus size={16} /> Upload document now
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
                        <div className="doc-card__type">{doc.document_type || "Medical Document"}</div>
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
                          title="Download original document"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="btn btn--secondary"
                          style={{ padding: "6px 10px", fontSize: 12, color: "var(--brick)" }}
                          onClick={(e) => handleDeleteDoc(e, doc.id)}
                          title="Delete document"
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
                <Plus size={16} /> Upload another document
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
              <h3 className="side-card__title">Recent Prescribed Medications</h3>
            </div>
            {recentMeds.length > 0 ? (
              <div className="med-widget-list">
                {recentMeds.slice(0, 5).map((m, idx) => (
                  <div key={idx} className="med-widget-item">
                    <div>
                      <div className="med-widget-name">{m.name}</div>
                      <div className="med-widget-sub">
                        {m.dosage ? `Dosage: ${m.dosage}` : "As prescribed"} {m.frequency ? `· ${m.frequency}` : ""}
                      </div>
                    </div>
                    <span className="badge badge--teal" style={{ fontSize: 10 }}>Rx</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
                Upload prescriptions to automatically generate a clear summary of your active medications here.
              </p>
            )}
          </div>

          {/* Quick Health Records Summary */}
          <div className="side-card">
            <div className="side-card__header">
              <div className="side-card__icon"><ClipboardList size={16} /></div>
              <h3 className="side-card__title">Records Summary</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--ink-soft)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total Stored Records:</span>
                <strong style={{ color: "var(--ink)" }}>{documents.length}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Preferred Language:</span>
                <span className="badge badge--teal">{getLanguageName(patient?.preferred_language || "Hindi")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Last Updated:</span>
                <strong style={{ color: "var(--ink)" }}>
                  {documents[0]?.uploaded_at ? new Date(documents[0].uploaded_at).toLocaleDateString() : "No uploads yet"}
                </strong>
              </div>
            </div>
          </div>

          {/* Prescription Timings Cheat Sheet */}
          <div className="side-card">
            <div className="side-card__header">
              <div className="side-card__icon"><Sparkles size={16} /></div>
              <h3 className="side-card__title">Doctor Shorthand Guide</h3>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "0 0 10px 0" }}>
              Quick guide to understanding medicine timing symbols on your prescriptions:
            </p>
            <div className="cheat-sheet-grid">
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">1 - 0 - 1</span>
                <span className="cheat-sheet-desc">Morning & Evening</span>
              </div>
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">1 - 1 - 1</span>
                <span className="cheat-sheet-desc">Thrice a day</span>
              </div>
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">OD / BD</span>
                <span className="cheat-sheet-desc">Once / Twice daily</span>
              </div>
              <div className="cheat-sheet-item">
                <span className="cheat-sheet-code">AC / PC</span>
                <span className="cheat-sheet-desc">Before / After meals</span>
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
            Take Document Photo
          </h3>
          <button
            onClick={handleClose}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4 }}
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
                Close and choose from files
              </button>
            </div>
          ) : capturedImg ? (
            <img src={capturedImg.previewUrl} alt="Captured prescription" className="camera-preview-img" />
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              <div className="camera-guide-overlay">
                <span className="camera-guide-text">Position prescription or document within frame</span>
                <span className="camera-guide-text">Hold steady for sharp OCR text</span>
              </div>
            </>
          )}
        </div>

        <div className="camera-controls">
          {capturedImg ? (
            <>
              <button type="button" className="camera-tool-btn" onClick={handleRetake}>
                <RefreshCw size={15} /> Retake
              </button>
              <button type="button" className="btn btn--primary" onClick={handleUsePhoto}>
                <Check size={16} /> Use this photo
              </button>
            </>
          ) : (
            <>
              {devices.length > 1 ? (
                <button type="button" className="camera-tool-btn" onClick={switchCamera}>
                  <RefreshCw size={15} /> Switch camera
                </button>
              ) : (
                <div style={{ width: 80 }} />
              )}

              {!cameraError && (
                <button
                  type="button"
                  className="shutter-btn"
                  onClick={takeSnapshot}
                  title="Take photo"
                >
                  <Camera size={26} />
                </button>
              )}

              <button type="button" className="camera-tool-btn" onClick={handleClose}>
                Cancel
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
      title={role === "patient" ? "Upload a document" : "Upload for a patient"}
      subtitle={
        role === "patient"
          ? "Snap a photo of your prescription or upload a PDF/report — our AI pipeline will extract the medicines, simplify the notes, and translate it for you."
          : "Choose which patient this document belongs to, then photograph or upload it on their behalf."
      }
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
              <h2>Patient Assignment</h2>
              <Field label="Select patient" hint="Attach this medical document to an existing patient profile">
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
              <h2>Document Source</h2>

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
                    {isDragging ? "Drop your document here" : "Drag and drop your document here"}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
                    Supports PDF, JPG, or PNG (prescriptions, lab tests, discharge summaries)
                  </p>
                  <div className="upload-drop-zone__actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud size={15} /> Choose file from device
                    </button>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      onClick={() => setIsCameraOpen(true)}
                    >
                      <Camera size={15} /> Take photo with camera
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
                    Change / Retake
                  </button>
                </div>
              )}

              <Field label="Translate explanation into" hint="Select the Indian language for the patient explanation">
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
                <div className="upload-stepper__title">Processing Document with AI</div>
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
                <UploadCloud size={16} /> Upload and process with AI
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
                <h3 className="side-card__title">Upload Guide & Best Practices</h3>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px 0", lineHeight: 1.5 }}>
                Follow these tips to get the highest OCR accuracy for doctor prescriptions and lab reports:
              </p>
              <div className="guide-tips-list">
                <div className="guide-tip-item">
                  <Camera size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>Sharp & Well-Lit Photos</strong>
                    <p style={{ margin: "2px 0 0" }}>Avoid dark shadows or blurry angles over handwritten notes.</p>
                  </div>
                </div>
                <div className="guide-tip-item">
                  <FileText size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>Supported Documents</strong>
                    <p style={{ margin: "2px 0 0" }}>Prescriptions, lab test reports, discharge summaries, and medical certificates.</p>
                  </div>
                </div>
                <div className="guide-tip-item">
                  <ShieldCheck size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>100% Private & Encrypted</strong>
                    <p style={{ margin: "2px 0 0" }}>Medical files are processed securely for patient care only.</p>
                  </div>
                </div>
                <div className="guide-tip-item">
                  <Globe size={16} className="guide-tip-icon" />
                  <div>
                    <strong style={{ color: "var(--ink)" }}>Instant Regional Translation</strong>
                    <p style={{ margin: "2px 0 0" }}>Explanations are simplified and translated into 10+ local languages.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-card">
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--panel)" }}>
                <h3 className="side-card__title" style={{ fontSize: 14 }}>Live Document Preview</h3>
                <span className="badge badge--teal">Ready</span>
              </div>
              <div className="preview-card__image-box">
                {previewUrl ? (
                  <img src={previewUrl} alt="Selected document live preview" />
                ) : (
                  <div style={{ textAlign: "center", padding: 32, color: "var(--ink-soft)" }}>
                    <FileText size={48} color="var(--teal)" style={{ marginBottom: 8 }} />
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>PDF Document Selected</p>
                    <span style={{ fontSize: 12 }}>{fileName}</span>
                  </div>
                )}
              </div>
              <div className="preview-card__details">
                <div className="preview-card__meta-row">
                  <span>File Name:</span>
                  <strong style={{ color: "var(--ink)" }}>{fileName}</strong>
                </div>
                <div className="preview-card__meta-row">
                  <span>File Size:</span>
                  <span>{file.size ? `${(file.size / 1024).toFixed(1)} KB` : "—"}</span>
                </div>
                <div className="preview-card__meta-row">
                  <span>Target Language:</span>
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
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [status, setStatus] = useState("idle"); // "idle" | "playing" | "paused"
  const [rate, setRate] = useState(1);
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
          <span>Listen to Summary</span>
          {isPlaying && (
            <div className="tts-waveform">
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="tts-bar" style={{ animationDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          )}
          {isPaused && <span className="tts-status-badge">Paused</span>}
        </div>

        <div className="tts-player__controls">
          <button
            className="tts-btn tts-btn--stop"
            onClick={handleStop}
            disabled={!isActive}
            title="Stop"
          >
            <Square size={13} fill={isActive ? "currentColor" : "none"} />
          </button>

          {isPlaying ? (
            <button className="tts-btn tts-btn--main" onClick={handlePause} title="Pause">
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
          <label htmlFor="tts-voice-select">Voice</label>
          <select
            id="tts-voice-select"
            value={selectedVoice || ""}
            onChange={(e) => {
              setSelectedVoice(e.target.value);
              if (isActive) handleStop();
            }}
          >
            {voices.length === 0 && <option value="">Loading voices…</option>}
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
        <summary>Preview speech script</summary>
        <p>{script || "No content available to speak."}</p>
      </details>
    </div>
  );
}


// ---------------------------------------------------------------------------
// AI CHATBOT COMPONENT
// ---------------------------------------------------------------------------

function AIChatBot({ documentId, initialLanguage = "hi" }) {
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
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, transcribing]);

  async function handleSend(textToSend) {
    const query = (textToSend || input).trim();
    if (!query || sending) return;

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
      const botMsg = {
        sender: "bot",
        text: res.response || "I couldn't process your question right now.",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      toast("Chat error: " + (err.message || "Failed to fetch response"), "error");
      const errorMsg = {
        sender: "bot",
        text: "Sorry, I encountered an error answering your query. Please try again.",
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
            setInput(res.text);
            toast("Speech transcribed! Click Send to post query.");
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

  return (
    <div className="section chatbot-card" style={{ marginTop: 24 }}>
      <div className="chatbot-header">
        <div className="chatbot-title">
          <div className="bot-avatar-badge">
            <Bot size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Ask Sehat Saathi (AI Medical Assistant)</h3>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
              Ask anything about your document, dosages, or health queries
            </p>
          </div>
        </div>
        <div className="chatbot-lang-select">
          <Globe size={14} color="var(--ink-soft)" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6 }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
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
              <div className="chat-text">{m.text}</div>
              <div className="chat-meta">
                <span>{m.time}</span>
                {m.sender === "bot" && <CopyButton text={m.text} />}
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
              <Loader2 size={14} className="spin" /> Transcribing speech audio...
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
          title={recording ? "Stop Recording" : "Speak your query (Voice Input)"}
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
}

// ---------------------------------------------------------------------------
// DOCUMENT DETAIL SCREEN
// ---------------------------------------------------------------------------

function DocumentDetailScreen({ role, documentId, onNav, onBack, onLogout }) {
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
      title={extraction.document_type || docRecord?.original_filename || "Document Details"}
      subtitle={
        docRecord
          ? `Uploaded ${new Date(docRecord.uploaded_at).toLocaleString()} · Language: ${getLanguageName(extraction.language)}`
          : "Analyzing document..."
      }
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button className="back-link" onClick={onBack} style={{ margin: 0 }}>
          <ArrowLeft size={15} /> Back to documents
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
          <p style={{ color: "var(--ink-soft)", margin: 0 }}>Loading document analysis...</p>
        </div>
      ) : (
        <div className="doc-detail-layout-grid">
          {/* MAIN COLUMN (LEFT) */}
          <div className="doc-detail-main">
            {/* TTS Player */}
            <TTSPlayer extraction={extraction} />

            <div className="section" style={{ marginTop: 24 }}>
              <h2>Plain Language Explanations</h2>
              {extraction.simplified_explanation && (
                <div className="explanation-block">
                  <div className="explanation-block__header">
                    <span className="lang-tag badge badge--teal">English (Simplified)</span>
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

            <div className="section">
              <h2>Extracted Medications ({medications.length})</h2>
              {medications.length === 0 ? (
                <p style={{ color: "var(--ink-soft)" }}>No structured medications were detected in this document.</p>
              ) : (
                <>
                  <div className="med-cards">
                    {paginatedMedications.map((m, idx) => (
                      <div key={idx} className="med-card">
                        <div className="med-card__name">{m.name || "Unnamed Medicine"}</div>
                        <div className="med-chip-row">
                          {m.dosage && (
                            <span className="med-chip">
                              <span className="med-chip__label">Dosage:</span> {m.dosage}
                            </span>
                          )}
                          {m.frequency && (
                            <span className="med-chip">
                              <span className="med-chip__label">Frequency:</span> {m.frequency}
                            </span>
                          )}
                          {m.duration && (
                            <span className="med-chip">
                              <span className="med-chip__label">Duration:</span> {m.duration}
                            </span>
                          )}
                        </div>
                        {m.instruction && (
                          <div className="med-card__instruction">
                            <strong>Notes: </strong>{m.instruction}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <Pagination
                    currentPage={medPage}
                    totalItems={medications.length}
                    pageSize={5}
                    onPageChange={setMedPage}
                  />
                </>
              )}
            </div>

            {extraction.raw_text && (
              <div className="section" style={{ border: "none" }}>
                <details className="raw-text">
                  <summary>Show raw extracted OCR text</summary>
                  <pre>{extraction.raw_text}</pre>
                </details>
              </div>
            )}

            {/* AI MEDICAL CHATBOT */}
            <AIChatBot documentId={documentId} initialLanguage={extraction.language || "hi"} />
          </div>

          {/* SIDE PANEL (RIGHT) */}
          <div className="doc-detail-side-panel">
            {/* Overview & Quick Actions Card */}
            <div className="side-card">
              <div className="side-card__header">
                <FileText size={18} color="var(--teal)" />
                <h3 className="side-card__title">Document Details</h3>
              </div>

              <div className="doc-meta-list">
                <div className="doc-meta-item">
                  <span className="doc-meta-label">Type:</span>
                  <span className="badge badge--teal" style={{ textTransform: "capitalize" }}>
                    {(extraction.document_type || "prescription").replace("_", " ")}
                  </span>
                </div>
                <div className="doc-meta-item">
                  <span className="doc-meta-label">Target Language:</span>
                  <span className="badge badge--gold">{getLanguageName(extraction.language)}</span>
                </div>
                <div className="doc-meta-item">
                  <span className="doc-meta-label">Uploaded:</span>
                  <span style={{ fontSize: "13px", color: "var(--ink)", fontWeight: 500 }}>
                    {docRecord ? new Date(docRecord.uploaded_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
                <div className="doc-meta-item">
                  <span className="doc-meta-label">File Name:</span>
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

            {/* Extracted Prescribed Medicines Summary */}
            {medications.length > 0 && (
              <div className="side-card">
                <div className="side-card__header">
                  <Pill size={18} color="var(--teal)" />
                  <h3 className="side-card__title">Meds List ({medications.length})</h3>
                </div>
                <div className="med-widget-list">
                  {medications.slice(0, 6).map((m, idx) => (
                    <div key={idx} className="med-widget-item">
                      <span className="med-widget-name">{m.name || "Medicine"}</span>
                      <span className="med-widget-sub">{m.dosage || "As prescribed"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timing Guide */}
            <div className="side-card">
              <div className="side-card__header">
                <Sparkles size={18} color="var(--teal)" />
                <h3 className="side-card__title">Prescription Timings</h3>
              </div>
              <p className="side-card__text" style={{ fontSize: "12.5px", marginBottom: 12 }}>
                Quick guide to medicine symbols:
              </p>
              <div className="cheat-sheet-grid">
                <div className="cheat-sheet-item"><strong>1-0-1</strong> Morning & Night</div>
                <div className="cheat-sheet-item"><strong>1-1-1</strong> 3 times daily</div>
                <div className="cheat-sheet-item"><strong>OD</strong> Once daily</div>
                <div className="cheat-sheet-item"><strong>BD</strong> Twice daily</div>
                <div className="cheat-sheet-item"><strong>AC</strong> Before meals</div>
                <div className="cheat-sheet-item"><strong>PC</strong> After meals</div>
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
Blood Group: ${bloodGroup || 'Unspecified'}
Emergency Contact: ${emergencyContact || 'Not provided'}
Known Allergies: ${allergies || 'None listed'}
Medical Conditions: ${medicalConditions || 'None listed'}
Preferred Language: ${preferredLang || 'Hindi'}
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
      title="Your profile"
      subtitle="Manage your personal details, emergency medical baseline, and app preferences."
    >
      <div className="profile-wrapper">
        {success && (
          <div className="alert alert--success" style={{ marginBottom: 20 }}>
            <CheckCircle2 size={18} />
            <span>Profile changes saved successfully!</span>
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
                    title="Copy Patient ID"
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
              <span className="completion-title">Profile Completeness</span>
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
                <div className="stat-label">Uploaded Records</div>
              </div>
            </div>
            <div className="profile-stat-card">
              <Globe size={20} className="stat-icon" />
              <div>
                <div className="stat-value">{preferredLang}</div>
                <div className="stat-label">Target Language</div>
              </div>
            </div>
            <div className="profile-stat-card">
              <Activity size={20} className="stat-icon" />
              <div>
                <div className="stat-value">{bloodGroup || "Not Set"}</div>
                <div className="stat-label">Blood Group</div>
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
                <h3 className="profile-card__title">Personal Information</h3>
                <p className="profile-card__subtitle">Basic identity details for identification on records</p>
              </div>
            </div>

            <div className="profile-form-grid">
              <Field label="Full name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                />
              </Field>

              <Field label="Age">
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 34"
                  min="0"
                  max="120"
                />
              </Field>

              <Field label="Gender">
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </Field>

              <Field label="Phone number">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
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
                <h3 className="profile-card__title">Medical Baseline & Emergency Info</h3>
                <p className="profile-card__subtitle">Essential clinical context used in emergency situations and AI processing</p>
              </div>
            </div>

            <div className="profile-form-grid">
              <Field label="Blood Group">
                <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                  <option value="">Select Blood Group</option>
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

              <Field label="Emergency Contact Phone">
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Primary emergency contact"
                />
              </Field>

              <div className="profile-field-full">
                <Field label="Known Allergies & Drug Sensitivities" hint="e.g. Penicillin, Sulfa drugs, Peanuts, Latex">
                  <input
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="List any known allergies"
                  />
                </Field>
              </div>

              <div className="profile-field-full">
                <Field label="Chronic Medical Conditions / Health Notes" hint="e.g. Type 2 Diabetes, Hypertension, Asthma">
                  <textarea
                    rows={2}
                    value={medicalConditions}
                    onChange={(e) => setMedicalConditions(e.target.value)}
                    placeholder="Any chronic health conditions or ongoing medical notes"
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
                <h3 className="profile-card__title">Language & Accessibility Settings</h3>
                <p className="profile-card__subtitle">Default translation target and voice narration controls</p>
              </div>
            </div>

            <div className="profile-form-grid">
              <Field label="Preferred Translation Language" hint="Used automatically when processing uploaded prescriptions">
                <select value={preferredLang} onChange={(e) => setPreferredLang(e.target.value)}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Voice Audio Speed" hint="Controls playback speed when reading prescription audio summaries">
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
                <h3 className="profile-card__title">Emergency Patient ID Pass</h3>
                <p className="profile-card__subtitle">Instant digital emergency record summary for doctors or first responders</p>
              </div>
            </div>

            <div className="emergency-pass-body">
              <div className="emergency-pass-chip-header">
                <div className="pass-chip-title">SEHAT SAATHI EMERGENCY MEDICAL ID</div>
                <div className="pass-chip-id">ID: {patient?.id || "N/A"}</div>
              </div>

              <div className="emergency-pass-details">
                <div className="pass-detail-item">
                  <span className="pass-label">Patient Name</span>
                  <span className="pass-val">{name || "—"}</span>
                </div>
                <div className="pass-detail-item">
                  <span className="pass-label">Age & Gender</span>
                  <span className="pass-val">{age ? `${age} yrs` : "—"} / {gender || "—"}</span>
                </div>
                <div className="pass-detail-item">
                  <span className="pass-label">Blood Group</span>
                  <span className="pass-val pass-highlight">{bloodGroup || "Not specified"}</span>
                </div>
                <div className="pass-detail-item">
                  <span className="pass-label">Emergency Contact</span>
                  <span className="pass-val">{emergencyContact || "Not set"}</span>
                </div>
                <div className="pass-detail-item full-width">
                  <span className="pass-label">Known Allergies</span>
                  <span className="pass-val">{allergies || "No allergies listed"}</span>
                </div>
                <div className="pass-detail-item full-width">
                  <span className="pass-label">Medical Conditions</span>
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
                  {copiedPass ? "Copied Pass Summary!" : "Copy Emergency Pass Text"}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => window.print()}
                >
                  <FileText size={14} /> Print / Save Pass PDF
                </button>
              </div>
            </div>
          </div>

          {/* SAVE ACTION BAR */}
          <div className="profile-actions-bar">
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              Ensure all changes are saved before navigating away.
            </span>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? <span className="spinner" /> : "Save Profile Changes"}
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
              <h3 className="profile-card__title" style={{ color: "var(--brick)" }}>Danger Zone</h3>
              <p className="profile-card__subtitle">Permanently remove your account and stored medical records</p>
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
// HEALTH WORKER SCREENS
// ---------------------------------------------------------------------------

function WorkerDashboard({ user, profile, onNav, onOpenPatient, onOpenDocument, onLogout }) {
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
      userName={profile?.name || user?.name || "Healthcare Staff"}
      title="Healthcare Worker Portal"
      subtitle={profile?.department ? `${profile.department} · ID: ${profile.employee_id || "Staff"}` : "Manage patient documents, community health records, and AI pipeline outputs."}
    >
      <div className="stat-row">
        <div className="stat">
          <div className="stat__value">{patients.length}</div>
          <div className="stat__label">Registered Patients</div>
        </div>
        <div className="stat">
          <div className="stat__value">{allDocs.length}</div>
          <div className="stat__label">Processed Documents</div>
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === "patients" ? "active" : ""}`}
          onClick={() => setTab("patients")}
        >
          <Users size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Patients Directory ({patients.length})
        </button>
        <button
          className={`tab-btn ${tab === "documents" ? "active" : ""}`}
          onClick={() => setTab("documents")}
        >
          <FileText size={15} style={{ marginRight: 6, verticalAlign: "middle" }} />
          All Documents ({allDocs.length})
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
                  placeholder="Search patient by name, phone or ID..."
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
                  title="Grid Cards View"
                >
                  <Grid size={15} style={{ marginRight: 4 }} /> Cards
                </button>
                <button
                  className={`view-mode-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table List View"
                >
                  <List size={15} style={{ marginRight: 4 }} /> List
                </button>
              </div>

              <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} /> Register new patient
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-box">
              <div className="pulse-ring" />
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>Loading patients directory...</p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="empty-state">
              <Users size={40} color="var(--ink-faint)" />
              <h4 style={{ margin: "12px 0 4px", fontSize: 16 }}>No patients found</h4>
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
                            <span className="patient-card__label">Demographics:</span>
                            <span className="patient-card__val">
                              {p.age ? `${p.age} yrs` : "Age unrecorded"} · {p.gender || "Gender unrecorded"}
                            </span>
                          </div>

                          <div className="patient-card__row">
                            <Phone size={14} />
                            <span className="patient-card__label">Phone:</span>
                            <span className="patient-card__val">{p.phone_number || "Not provided"}</span>
                          </div>

                          <div className="patient-card__row">
                            <FileText size={14} />
                            <span className="patient-card__label">Documents:</span>
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
                      <th>Patient Name & ID</th>
                      <th>Demographics</th>
                      <th>Contact Phone</th>
                      <th>Preferred Language</th>
                      <th>Records Attached</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
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
              <p style={{ color: "var(--ink-soft)", margin: 0 }}>Loading all documents...</p>
            </div>
          ) : allDocs.length === 0 ? (
            <div className="empty-state">
              <FileText size={36} color="var(--ink-faint)" />
              <p>No documents uploaded yet across all patients.</p>
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
                        title="Download file"
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
                        title="Delete file"
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
          <h2>AI Pipeline Stage Debugger</h2>
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
              <span>Viewing: <strong>{selectedStageFile}</strong></span>
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
              <h2 style={{ margin: 0, fontSize: 18 }}>Register New Patient</h2>
              <button
                style={{ background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPatient}>
              <Field label="Patient Full Name">
                <input
                  type="text"
                  placeholder="e.g. Maya Devi"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  required
                />
              </Field>

              <div className="field-row">
                <Field label="Age">
                  <input
                    type="number"
                    placeholder="45"
                    value={newPatientAge}
                    onChange={(e) => setNewPatientAge(e.target.value)}
                  />
                </Field>
                <Field label="Gender">
                  <select value={newPatientGender} onChange={(e) => setNewPatientGender(e.target.value)}>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </Field>
              </div>

              <Field label="Phone number">
                <input
                  type="tel"
                  placeholder="98765 43210"
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                />
              </Field>

              <Field label="Preferred Language">
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
                  Cancel
                </button>
                <button type="submit" className="btn btn--primary" disabled={addingPatient}>
                  {addingPatient ? <span className="spinner" /> : "Save Patient"}
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
          <ArrowLeft size={15} /> Back to patients
        </button>
        <div>
          <button className="btn btn--secondary" onClick={() => setEditing(!editing)}>
            <Edit3 size={15} /> {editing ? "Cancel Editing" : "Edit Profile"}
          </button>
        </div>
      </div>


      {editing && (
        <form onSubmit={handleSaveEdit} className="section" style={{ background: "var(--panel)", padding: 20, borderRadius: "var(--radius-m)" }}>
          <h3>Edit Patient Details</h3>
          <div className="field-row">
            <Field label="Full Name">
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </Field>
            <Field label="Age">
              <input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Gender">
              <select value={editGender} onChange={(e) => setEditGender(e.target.value)}>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Phone">
              <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="Preferred Language">
            <select value={editLang} onChange={(e) => setEditLang(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.name}>{l.name}</option>
              ))}
            </select>
          </Field>
          <button type="submit" className="btn btn--primary">Save Changes</button>
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
            <p>No documents uploaded yet for this patient.</p>
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
                      title="Download original file"
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
                      title="Delete document"
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
  const [activePanel, setActivePanel] = useState("overview");

  const adminName = user?.name || user?.email || "Admin";

  const panelTitles = {
    overview: { title: "System Overview", subtitle: "Live metrics across the entire platform" },
    users: { title: "User Management", subtitle: "Manage accounts, roles, and verification" },
    patients: { title: "Patient Audit", subtitle: "All registered patient profiles with document counts" },
    documents: { title: "Document Audit", subtitle: "System-wide uploaded documents" },
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
      <span>Loading system statistics…</span>
    </div>
  );

  if (!stats) return <div className="admin-empty"><p>Failed to load statistics.</p></div>;

  const maxLangCount = stats.language_breakdown?.length
    ? Math.max(...stats.language_breakdown.map((l) => l.count))
    : 1;

  return (
    <>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-card__icon"><Users size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_users ?? 0}</div>
          <div className="admin-stat-card__label">Total Users</div>
          <div className="admin-stat-card__sub">
            {stats.users_by_role?.patient ?? 0} patients · {stats.users_by_role?.healthcare_worker ?? 0} workers · {stats.users_by_role?.admin ?? 0} admins
          </div>
        </div>

        <div className="admin-stat-card admin-stat-card--green">
          <div className="admin-stat-card__icon"><User size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_patients ?? 0}</div>
          <div className="admin-stat-card__label">Patients</div>
        </div>

        <div className="admin-stat-card admin-stat-card--teal">
          <div className="admin-stat-card__icon"><FileText size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_documents ?? 0}</div>
          <div className="admin-stat-card__label">Documents Uploaded</div>
          <div className="admin-stat-card__sub">{stats.total_extractions ?? 0} processed</div>
        </div>

        <div className="admin-stat-card admin-stat-card--gold">
          <div className="admin-stat-card__icon"><ShieldCheck size={18} /></div>
          <div className="admin-stat-card__value">{stats.total_healthcare_workers ?? 0}</div>
          <div className="admin-stat-card__label">Healthcare Workers</div>
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
            <div className="admin-empty"><p>No translation data yet.</p></div>
          )}
        </div>

        {/* Recent uploads */}
        <div className="admin-panel">
          <div className="admin-panel__header">
            <h3 className="admin-panel__title">
              <Activity size={15} /> Recent Uploads
            </h3>
            <span className="admin-panel__count">last 10</span>
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
            <div className="admin-empty"><p>No uploads yet.</p></div>
          )}
        </div>
      </div>
    </>
  );
}

// ---- Users Panel ----
function AdminUsersPanel() {
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
          <UserCog size={15} /> User Accounts
          <span className="admin-panel__count">{users.length}</span>
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn--secondary" onClick={load} style={{ fontSize: 12, padding: "6px 10px" }}>
            <RefreshCw size={13} />
          </button>
          <div className="admin-search-wrap">
            <Search size={14} />
            <input
              placeholder="Search by name, email, or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="admin-panel__body">
        {loading ? (
          <div className="admin-loading"><div className="pulse-ring" /><span>Loading users…</span></div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty"><Users size={32} /><p>No users found.</p></div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name / Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
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
                            {u.is_verified ? "Verified" : "Unverified"}
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
                              title="Promote to Admin"
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
                              {u.is_verified ? "Revoke" : "Verify"}
                            </button>
                          )}
                          <button
                            className="admin-action-btn admin-action-btn--danger admin-action-btn--sm"
                            onClick={() => handleDelete(u)}
                            disabled={updating === u.id}
                            title="Delete user"
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
          <Users size={15} /> Registered Patients
          <span className="admin-panel__count">{patients.length}</span>
        </h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn--secondary" onClick={load} style={{ fontSize: 12, padding: "6px 10px" }}>
            <RefreshCw size={13} />
          </button>
          <div className="admin-search-wrap">
            <Search size={14} />
            <input
              placeholder="Search by name or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="admin-panel__body">
        {loading ? (
          <div className="admin-loading"><div className="pulse-ring" /><span>Loading patients…</span></div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty"><User size={32} /><p>No patients found.</p></div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Age / Gender</th>
                    <th>Language</th>
                    <th>Phone</th>
                    <th>Documents</th>
                    <th>Joined</th>
                    <th>Actions</th>
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
                          title="Delete patient"
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
              placeholder="Search by filename or type…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="admin-panel__body">
        {loading ? (
          <div className="admin-loading"><div className="pulse-ring" /><span>Loading documents…</span></div>
        ) : filtered.length === 0 ? (
          <div className="admin-empty"><FileText size={32} /><p>No documents found.</p></div>
        ) : (
          <>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Type</th>
                    <th>Patient ID</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
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
                            title="Download file"
                          >
                            <Download size={12} />
                          </button>
                          <button
                            className="admin-action-btn admin-action-btn--danger admin-action-btn--sm"
                            onClick={() => handleDelete(d)}
                            title="Delete document"
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
// ROOT APP COMPONENT
// ---------------------------------------------------------------------------

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState("patient");
  const [screen, setScreen] = useState("landing");
  const [activePatient, setActivePatient] = useState(null);
  const [activeDocId, setActiveDocId] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

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

  function goTo(key) {
    if (key === "login") {
      handleLogout();
      return;
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
          <p style={{ color: "var(--ink-soft)", marginTop: 8 }}>Connecting to healthcare services...</p>
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
    <div className="ss-root">
      <GlobalModals />
      <PageTransition key={screen + (role || "")}>
        {body}
      </PageTransition>
    </div>
  );
}
