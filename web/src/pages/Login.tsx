import { useState } from "react";
import { useNavigate, Navigate } from "react-router";
import { BRAND } from "../brand";

// ── auth data ──────────────────────────────────────────────────────
// Demo credentials follow the demo-html convention: the password is the
// same as the username (which is the role id). Validation requires a
// known role id AND username === password.
const ROLES = [
  { id: "user_executive",       label: "Executive",       initials: "EX", defaultPath: "/portfolio" },
  { id: "user_developer",       label: "Developer",       initials: "DV", defaultPath: "/knowledge-management" },
  { id: "user_program_manager", label: "Program Manager", initials: "PM", defaultPath: "/knowledge-management" },
  { id: "user_product_ops",     label: "Product Ops",     initials: "PO", defaultPath: "/knowledge-management" },
];

export { ROLES };

// ── hero SVG — payment-network motif ──────────────────────────────
function HeroArt() {
  const nodes: [number, number, boolean][] = [
    [130,155,true],[240,110,false],[360,175,false],[90,260,false],
    [190,310,true],[310,265,false],[380,370,false],[80,390,false],
    [220,430,true],[330,445,false],
  ];
  const edges: [number,number,number,number,boolean][] = [
    [130,155,240,110,true],[240,110,360,175,false],[130,155,90,260,false],
    [90,260,190,310,false],[360,175,310,265,false],[190,310,310,265,true],
    [310,265,380,370,false],[190,310,220,430,false],[80,390,220,430,false],
    [220,430,330,445,false],[310,265,330,445,false],
  ];
  return (
    <svg viewBox="0 0 480 520" fill="none" aria-hidden="true"
      style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}>
      <defs>
        <radialGradient id="lg-rg1" cx="62%" cy="68%" r="58%">
          <stop offset="0%" stopColor="#2451E8" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#0A1F5F" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="lg-rg2" cx="10%" cy="15%" r="55%">
          <stop offset="0%" stopColor="#F7B600" stopOpacity="0.07"/>
          <stop offset="100%" stopColor="#0A1F5F" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="480" height="520" fill="url(#lg-rg1)"/>
      <rect width="480" height="520" fill="url(#lg-rg2)"/>
      {/* concentric arcs from bottom-right */}
      {[90,200,330,470,630].map((r,i) => (
        <circle key={r} cx="462" cy="502" r={r}
          stroke={`rgba(255,255,255,${+(0.075 - i*0.013).toFixed(3)})`} strokeWidth="1" fill="none"/>
      ))}
      {/* subtle grid */}
      {[100,180,260,340,420].map(y => (
        <line key={`h${y}`} x1="0" y1={y} x2="480" y2={y} stroke="rgba(255,255,255,0.035)" strokeWidth="0.75"/>
      ))}
      {[80,190,300,400].map(x => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="520" stroke="rgba(255,255,255,0.025)" strokeWidth="0.75"/>
      ))}
      {/* edges */}
      {edges.map(([x1,y1,x2,y2,gold],i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={gold ? "rgba(247,182,0,0.22)" : "rgba(255,255,255,0.09)"}
          strokeWidth={gold ? 1.3 : 0.85}/>
      ))}
      {/* nodes */}
      {nodes.map(([x,y,gold],i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={gold ? 10 : 7}
            fill={gold ? "rgba(247,182,0,0.1)" : "rgba(255,255,255,0.05)"}/>
          <circle cx={x} cy={y} r={gold ? 3.5 : 2.5}
            fill={gold ? "rgba(247,182,0,0.8)" : "rgba(255,255,255,0.45)"}/>
        </g>
      ))}
    </svg>
  );
}

// ── page ──────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const [roleId, setRoleId] = useState(ROLES[0].id);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // ── auth guard (unchanged) ──────────────────────────────────────
  const existingRole = localStorage.getItem("demo_role");
  if (existingRole) {
    const role = ROLES.find((r) => r.id === existingRole);
    return <Navigate to={role?.defaultPath ?? "/"} replace />;
  }

  const selected = ROLES.find((r) => r.id === roleId)!;

  // Clicking a role card selects it AND auto-populates the username and
  // password fields (password = username, per the demo-html convention).
  function pickRole(id: string) {
    setRoleId(id);
    setUsername(id);
    setPassword(id);
    setError("");
  }

  function handleLogin() {
    const uname = username.trim();
    const pass = password.trim();
    const cred = ROLES.find((r) => r.id === uname);
    // Valid when the username is a known role id and password === username.
    if (cred && uname === pass) {
      setError("");
      localStorage.setItem("demo_role", cred.id);
      navigate(cred.defaultPath, { replace: true });
    } else {
      setError("Invalid username or password.");
    }
  }
  // ── end auth logic ─────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes _lgFadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        ._lg-shell {
          position: fixed; inset: 0;
          display: flex;
          font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          -webkit-font-smoothing: antialiased;
        }
        ._lg-hero {
          flex: 0 0 52%;
          position: relative; overflow: hidden;
          display: flex; flex-direction: column; justify-content: flex-end;
          padding: 52px 48px;
          background: linear-gradient(148deg, #091b55 0%, #1030b8 58%, #1a45d8 100%);
        }
        ._lg-form-wrap {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          background: #ffffff;
          overflow-y: auto;
          padding: 48px 32px;
        }
        ._lg-form-inner {
          width: 100%; max-width: 376px;
          animation: _lgFadeUp 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        ._lg-role-card {
          background: #F5F8FF;
          border: 1.5px solid #DDE5F8;
          border-radius: 12px;
          padding: 14px 14px 12px;
          cursor: pointer; text-align: left; width: 100%;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
        }
        ._lg-role-card:hover {
          border-color: #1434CB; background: #EBF0FF;
        }
        ._lg-role-card.active {
          border-color: #1434CB; background: #EBF0FF;
          box-shadow: 0 0 0 3px rgba(20,52,203,0.1);
        }
        ._lg-role-card:focus-visible {
          outline: 2px solid #1434CB; outline-offset: 2px;
        }
        ._lg-btn {
          width: 100%; padding: 14px;
          background: #1434CB; border: none; border-radius: 10px;
          color: #fff; font-size: 15px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.015em;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          font-family: inherit;
        }
        ._lg-btn:hover {
          background: #0D24A0; transform: translateY(-1px);
          box-shadow: 0 6px 22px rgba(20,52,203,0.32);
        }
        ._lg-btn:active  { transform: translateY(0); box-shadow: none; }
        ._lg-btn:focus-visible { outline: 2.5px solid #F7B600; outline-offset: 3px; }
        ._lg-hero-stats { display: flex; gap: 28px; }
        ._lg-input {
          width: 100%; box-sizing: border-box;
          background: #F5F8FF; border: 1.5px solid #DDE5F8; border-radius: 10px;
          padding: 11px 14px; font-size: 12.5px; color: #64748B;
          font-family: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
          outline: none; transition: border-color 0.15s;
        }
        ._lg-input:focus { border-color: #1434CB; }
        @media (max-width: 767px) {
          ._lg-shell  { flex-direction: column; }
          ._lg-hero   { flex: 0 0 auto; padding: 28px 24px 32px; }
          ._lg-hero-stats { display: none; }
          ._lg-hero-art svg { opacity: 0.5; }
          ._lg-form-wrap { padding: 32px 20px 52px; }
        }
        @media (max-width: 479px) {
          ._lg-form-wrap { padding: 24px 16px 48px; }
          ._lg-role-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      <div className="_lg-shell" role="main">

        {/* ── Hero panel ──────────────────────────────────────────── */}
        <section className="_lg-hero" aria-label="Branding">
          <div className="_lg-hero-art" style={{ position:"absolute", inset:0 }}>
            <HeroArt />
          </div>

          {/* Gold accent bar at top */}
          <div style={{ position:"absolute", top:0, left:0, right:0, height:3,
            background:"linear-gradient(90deg, #F7B600 0%, rgba(247,182,0,0.3) 60%, transparent 100%)" }}/>

          {/* Content — sits above the SVG */}
          <div style={{ position:"relative", zIndex:1 }}>

            {/* Logo mark */}
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:36 }}>
              <div style={{
                width:64, height:40, background:"#fff", borderRadius:7,
                display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                boxShadow:"0 2px 12px rgba(0,0,0,0.25)",
              }}>
                <span style={{ fontSize:17, fontWeight:900, fontStyle:"italic", color:"#1434CB", letterSpacing:"-0.02em" }}>
                  {BRAND.name}
                </span>
              </div>
              <div>
                <div style={{ color:"rgba(255,255,255,0.45)", fontSize:10, fontWeight:700,
                  letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>
                  Enterprise
                </div>
                <div style={{ color:"#fff", fontSize:13.5, fontWeight:600, lineHeight:1.3 }}>
                  {BRAND.product}
                </div>
              </div>
            </div>

            {/* Headline */}
            <h1 style={{ color:"#fff", fontSize:34, fontWeight:800, lineHeight:1.15,
              margin:"0 0 14px", letterSpacing:"-0.025em", maxWidth:360 }}>
              AI-Powered Work &<br/>
              Knowledge Management
            </h1>
            <p style={{ color:"rgba(255,255,255,0.58)", fontSize:13.5, lineHeight:1.7,
              margin:"0 0 44px", maxWidth:340 }}>
              Unified visibility across your payments portfolio — delivery pipelines, documentation, and knowledge graphs.
            </p>

            {/* Stats strip */}
            <div className="_lg-hero-stats">
              {([
                ["200+",  "Countries"],
                ["$15T+", "Annual Volume"],
                ["4.4B+", "Credentials"],
              ] as [string,string][]).map(([val, lbl]) => (
                <div key={lbl}>
                  <div style={{ color:"#F7B600", fontSize:21, fontWeight:800,
                    lineHeight:1.1, letterSpacing:"-0.02em" }}>{val}</div>
                  <div style={{ color:"rgba(255,255,255,0.45)", fontSize:10.5,
                    marginTop:4, letterSpacing:"0.06em" }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Form panel ──────────────────────────────────────────── */}
        <div className="_lg-form-wrap">
          <div className="_lg-form-inner">

            {/* Header */}
            <div style={{ marginBottom:28 }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:6,
                background:"#EBF0FF", borderRadius:20, padding:"4px 12px 4px 8px",
                marginBottom:16 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#1434CB" }}/>
                <span style={{ fontSize:11, fontWeight:700, color:"#1434CB",
                  letterSpacing:"0.06em", textTransform:"uppercase" }}>Demo Environment</span>
              </div>
              <h2 style={{ fontSize:26, fontWeight:800, color:"#0A1F5F",
                margin:"0 0 8px", letterSpacing:"-0.02em" }}>
                Welcome back
              </h2>
              <p style={{ fontSize:13.5, color:"#64748B", margin:0, lineHeight:1.55 }}>
                Select a role to access your workspace.
              </p>
            </div>

            {/* Role cards — radiogroup */}
            <div style={{ marginBottom:6 }}>
              <span style={{ display:"block", marginBottom:10, fontSize:11, fontWeight:700,
                color:"#64748B", textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Role
              </span>
              <div
                role="radiogroup"
                aria-label="Select role"
                className="_lg-role-grid"
                style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:0 }}
              >
                {ROLES.map((r) => {
                  const active = roleId === r.id;
                  return (
                    <button
                      key={r.id}
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickRole(r.id)}
                      className={`_lg-role-card${active ? " active" : ""}`}
                    >
                      {/* Avatar */}
                      <div style={{
                        width:34, height:34, borderRadius:9,
                        background: active ? "#1434CB" : "#DDE5F8",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        marginBottom:9, transition:"background 0.15s",
                      }}>
                        <span style={{
                          fontSize:11, fontWeight:800, letterSpacing:"0.05em",
                          color: active ? "#fff" : "#1434CB",
                          transition:"color 0.15s",
                        }}>
                          {r.initials}
                        </span>
                      </div>
                      <div style={{ fontSize:12.5, fontWeight:700,
                        color: active ? "#0A1F5F" : "#374151", lineHeight:1.2 }}>
                        {r.label}
                      </div>
                      <div style={{
                        fontSize:9.5, marginTop:3, overflow:"hidden",
                        textOverflow:"ellipsis", whiteSpace:"nowrap",
                        color: active ? "#F7B600" : "transparent",
                        fontFamily:"JetBrains Mono, monospace",
                        transition:"color 0.15s",
                      }}>
                        {r.defaultPath}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop:"1px solid #EDF0F7", margin:"20px 0" }}/>

            {/* Username */}
            <div style={{ marginBottom:16 }}>
              <label htmlFor="username" style={{ display:"block", marginBottom:7,
                fontSize:11, fontWeight:700, color:"#64748B",
                textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="off"
                placeholder="e.g. user_executive"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                className="_lg-input"
                style={{ fontFamily: "inherit", color: "#0A1F5F" }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom:16 }}>
              <label htmlFor="password" style={{ display:"block", marginBottom:7,
                fontSize:11, fontWeight:700, color:"#64748B",
                textTransform:"uppercase", letterSpacing:"0.08em" }}>
                Password
              </label>
              <div style={{ position:"relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Same as username"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
                  className="_lg-input"
                  style={{ fontFamily: "inherit", color: "#0A1F5F", paddingRight: 64 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position:"absolute", top:"50%", right:10, transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer",
                    fontSize:11, fontWeight:700, color:"#1434CB",
                    letterSpacing:"0.04em", padding:"4px 6px",
                  }}
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div role="alert" style={{
                marginBottom:16, padding:"10px 12px", borderRadius:8,
                background:"#FEF2F2", border:"1px solid #FECACA",
                color:"#B91C1C", fontSize:12.5, fontWeight:600,
              }}>
                {error}
              </div>
            )}

            {/* CTA */}
            <button
              onClick={handleLogin}
              className="_lg-btn"
              aria-label={`Sign in as ${selected.label}`}
            >
              Sign in
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="#fff" strokeWidth="1.75"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Security footer */}
            <div style={{ marginTop:22, display:"flex", alignItems:"center",
              justifyContent:"center", gap:6 }}>
              <svg width="11" height="13" viewBox="0 0 11 13" fill="none" aria-hidden="true">
                <rect x="0.75" y="4.75" width="9.5" height="7.5" rx="1.25"
                  stroke="#9CA3AF" strokeWidth="1.2"/>
                <path d="M3.5 4.75V3.25a2 2 0 0 1 4 0v1.5"
                  stroke="#9CA3AF" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize:11, color:"#9CA3AF", letterSpacing:"0.03em" }}>
                Secured by {BRAND.name} · Enterprise Authentication
              </span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
