import { useState } from "react";
import { useNavigate } from "react-router";

const ROLES = [
  { id: "user_executive", label: "Executive", initials: "EX" },
  { id: "user_developer", label: "Developer", initials: "DV" },
  { id: "user_program_manager", label: "Program Manager", initials: "PM" },
  { id: "user_product_ops", label: "Product Ops", initials: "PO" },
];

export { ROLES };

export default function Login() {
  const navigate = useNavigate();
  const [roleId, setRoleId] = useState(ROLES[0].id);

  const selected = ROLES.find((r) => r.id === roleId)!;

  function handleLogin() {
    localStorage.setItem("demo_role", roleId);
    navigate("/", { replace: true });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1434cb 0%, #0d24a0 55%, #0a1f5f 100%)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "0 16px",
          background: "rgba(255,255,255,0.07)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 18,
          padding: "32px",
          boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
          <div
            style={{
              width: 52,
              height: 32,
              background: "#1434CB",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              fontStyle: "italic",
              color: "#fff",
              letterSpacing: "0.05em",
              border: "1px solid rgba(255,255,255,0.25)",
              flexShrink: 0,
            }}
          >
            PAY
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
              Payments Platform
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 3 }}>
              Delivery Intelligence Portal
            </div>
          </div>
        </div>

        {/* Role dropdown */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="role-select"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.65)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Role
          </label>
          <select
            id="role-select"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              padding: "10px 36px 10px 13px",
              fontSize: 13,
              color: "#fff",
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.6)' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
            }}
          >
            {ROLES.map((r) => (
              <option key={r.id} value={r.id} style={{ background: "#0a1f5f", color: "#fff" }}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Username (prefilled, read-only) */}
        <div style={{ marginBottom: 24 }}>
          <label
            htmlFor="username"
            style={{
              display: "block",
              marginBottom: 6,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.65)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Username
          </label>
          <input
            id="username"
            type="text"
            readOnly
            value={selected.id}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "10px 13px",
              fontSize: 13,
              color: "rgba(255,255,255,0.55)",
              outline: "none",
              fontFamily: "JetBrains Mono, monospace",
            }}
          />
        </div>

        {/* Sign in button */}
        <button
          onClick={handleLogin}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#0D24A0")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#1434CB")}
          style={{
            width: "100%",
            padding: "11px",
            background: "#1434CB",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.15s",
          }}
        >
          Sign in →
        </button>

        {/* Demo account chips */}
        <div
          style={{
            marginTop: 24,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 20,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 10,
            }}
          >
            Demo Accounts
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRoleId(r.id)}
                style={{
                  background:
                    roleId === r.id
                      ? "rgba(247,182,0,0.15)"
                      : "rgba(255,255,255,0.04)",
                  border:
                    roleId === r.id
                      ? "1px solid rgba(247,182,0,0.35)"
                      : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
                  {r.label}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#F7B600",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {r.id}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
