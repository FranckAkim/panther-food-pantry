import { usePendingAction } from "../../components/loading/ActionContext.js";
import { useState } from "react";
import { notifyError } from "../../components/Notifications.jsx";
import { registerMock, signInMock } from "./mockAuth.js";
import { AsyncForm } from "../../components/ui/AsyncForm.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { mockAccounts, mockPassword } from "./data.js";
import { Modal } from "../../components/ui/Modal.jsx";

export function Auth({ page, role = "student", navigate, onSignIn, notify }) {
  const registration = page === "register";
  const { pending } = usePendingAction();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const title = registration
    ? "Create account"
    : role === "student"
      ? "Sign in"
      : `${role === "admin" ? "Admin" : "Staff"} sign in`;
  const signInPath = role === "student" ? "/sign-in" : `/${role}/sign-in`;

  async function submit(event, data) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address.endsWith("@pvamu.edu")) {
      notifyError("Use your Prairie View A&M email address ending in @pvamu.edu.");
      return;
    }
    const name = String(data.get("name") || "").trim();
    const studentId = String(data.get("studentId") || "")
      .trim()
      .toUpperCase();
    if (registration && (!name || !/^P\d{8}$/.test(studentId))) {
      notifyError("Enter your name and student ID: P followed by eight numbers.");
      return;
    }
    try {
      const profile = registration
        ? await registerMock({ name, email: address, studentId, password })
        : await signInMock(role, address, password);
      onSignIn(profile);
      setPassword("");
      notify(`Welcome, ${profile.name.split(" ")[0]}.`);
      navigate(profile.role === "student" ? "/student/home" : `/${profile.role}/dashboard`);
    } catch (problem) {
      notifyError(problem.message);
    }
  }

  return (
    <main
      className={`auth-layout ${registration ? "auth-layout--register" : ""}`}
      id="main-content"
      tabIndex={-1}
    >
      <aside className="auth-hero" aria-label="Panther Pantry">
        <img
          className="auth-photo"
          src="/assets/figma/c5c36.png"
          alt="Shelves of food and fresh produce at the campus pantry"
        />
        <div className="auth-photo-tint" />
        <a className="auth-brand" href={`#${signInPath}`}>
          <span className="auth-brand-mark">
            <img src="/assets/figma/126fe.svg" alt="" />
          </span>
          <span>
            <strong>Panther Pantry</strong>
            <small>Prairie View A&amp;M University</small>
          </span>
        </a>
        <div className="auth-message">
          <h2>
            {role === "student"
              ? "Request food and check your pickup."
              : role === "staff"
                ? "Help every Panther get the food they need."
                : "Keep the pantry running for our community."}
          </h2>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-form-container">
          {!registration && (
            <nav className="auth-portals" aria-label="Sign-in portal">
              {["student", "staff", "admin"].map((portal) => (
                <a
                  key={portal}
                  href={portal === "student" ? "#/sign-in" : `#/${portal}/sign-in`}
                  aria-current={role === portal ? "page" : undefined}
                >
                  {portal[0].toUpperCase() + portal.slice(1)}
                </a>
              ))}
            </nav>
          )}
          <h1>{title}</h1>
          {registration && (
            <p className="auth-intro">
              Use your real name and student ID so staff can match your ID card. We never ask why
              you need food.
            </p>
          )}
          <AsyncForm className="auth-form" onSubmit={submit}>
            {registration && (
              <>
                <Field label="Full name">
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="First and last name"
                    required
                    maxLength={100}
                  />
                </Field>
                <Field label="Student ID number">
                  <input
                    name="studentId"
                    placeholder="As shown on your ID card"
                    required
                    maxLength={9}
                  />
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="name@pvamu.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <div className="auth-password">
              <div className="auth-password-label">
                <label htmlFor="password">Password</label>
                {!registration && (
                  <button
                    type="button"
                    className="text-link"
                    disabled={!!pending}
                    onClick={() => setForgot(true)}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={registration ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={registration ? "Choose a password" : "Your password"}
                required
                minLength={registration ? 8 : 1}
              />
            </div>
            {registration && (
              <div className="notice">
                <Icon name="id" />
                <p>Bring your student ID card to your first pickup. Staff check it once.</p>
              </div>
            )}

            <Button
              type="submit"
              loadingLabel={registration ? "Creating account…" : "Signing in…"}
              className="button--full auth-submit"
            >
              {registration ? "Create account" : "Sign in"}
            </Button>
          </AsyncForm>
          {registration ? (
            <p className="auth-sign-in">
              Already have an account? <a href="#/sign-in">Sign in</a>
            </p>
          ) : (
            role === "student" && (
              <>
                <div className="auth-divider">
                  <span />
                  New here?
                  <span />
                </div>
                <Button
                  variant="secondary"
                  className="button--full"
                  onClick={() => navigate("/register")}
                >
                  Create an account
                </Button>
              </>
            )
          )}
          {!registration && (
            <div className="auth-mock-account">
              <p>Try a mock {role} account</p>
              <span>
                {mockAccounts[role].email} · {mockPassword}
              </span>
              <button
                type="button"
                className="text-link"
                disabled={!!pending}
                onClick={() => {
                  setEmail(mockAccounts[role].email);
                  setPassword(mockPassword);
                }}
              >
                Use sample credentials
              </button>
            </div>
          )}
        </div>
        <div className="auth-help">
          <Icon name="info" />
          <p>
            {role === "student"
              ? "Trouble signing up? Come to the pantry with your student ID card and staff will help you."
              : "Use your assigned pantry account. Contact your pantry administrator if you need access."}
          </p>
        </div>
      </section>
      {forgot && (
        <Modal
          title="Password help"
          onClose={() => setForgot(false)}
          footer={<Button onClick={() => setForgot(false)}>Back to sign in</Button>}
        >
          <p>
            This app currently uses mock accounts. For the sample {role} account, use{" "}
            <strong>{mockPassword}</strong>.
          </p>
          <p className="muted" style={{ marginTop: 12 }}>
            Email password recovery will be connected when the backend is added.
          </p>
        </Modal>
      )}
    </main>
  );
}
