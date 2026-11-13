import { usePendingAction } from "../../components/loading/ActionContext.js";
import { useState } from "react";
import { notifyError } from "../../components/Notifications.jsx";
import { register, sendPasswordReset, signIn, updatePassword } from "../../api/auth.js";
import { homeFor } from "../../app/useAppNavigation.js";
import { AsyncForm } from "../../components/ui/AsyncForm.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { Icon } from "../../components/ui/Icon.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";

// Shared demo accounts exist in the Supabase project; the password lives in the
// git-ignored .env.development.local, which Vite never loads for production builds.
const demoPassword = import.meta.env.DEV ? import.meta.env.VITE_DEMO_PASSWORD : undefined;
const campusEmail = (value) => value.trim().toLowerCase();

export function Auth({ page, role = "student", navigate, notify, onPasswordSaved, onSignedIn }) {
  const registration = page === "register";
  const resetting = page === "reset-password";
  const { pending } = usePendingAction();
  const [forgot, setForgot] = useState(false);
  const [resetSentTo, setResetSentTo] = useState("");
  const [confirmationSentTo, setConfirmationSentTo] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const title = resetting
    ? "Choose a new password"
    : registration
      ? "Create account"
      : role === "student"
        ? "Sign in"
        : `${role === "admin" ? "Admin" : "Staff"} sign in`;
  const signInPath = role === "student" ? "/sign-in" : `/${role}/sign-in`;

  async function submit(event, data) {
    event.preventDefault();
    // The session listener may already have moved a signed-in user on (and they may have
    // navigated further) by the time this finishes; only go home if still on this page.
    const startedOn = window.location.hash;
    const goHome = (role) => {
      if (window.location.hash === startedOn) navigate(homeFor(role));
    };
    if (resetting) {
      if (password !== String(data.get("confirm") || "")) {
        notifyError("The two passwords don't match.");
        return;
      }
      await updatePassword(password);
      setPassword("");
      onPasswordSaved?.();
      notify("Your password was updated.");
      navigate(homeFor(role));
      return;
    }
    const address = campusEmail(email);
    if (!address.endsWith("@pvamu.edu")) {
      notifyError("Use your Prairie View A&M email address ending in @pvamu.edu.");
      return;
    }
    if (registration) {
      const name = String(data.get("name") || "").trim();
      const studentId = String(data.get("studentId") || "")
        .trim()
        .toUpperCase();
      if (!name || !/^P\d{8}$/.test(studentId)) {
        notifyError("Enter your name and student ID: P followed by eight numbers.");
        return;
      }
      const result = await register({ name, studentId, email: address, password });
      setPassword("");
      if (result.needsConfirmation) {
        setConfirmationSentTo(address);
        return;
      }
      onSignedIn?.(result.account);
      notify(`Welcome, ${result.account.name.split(" ")[0]}.`);
      goHome("student");
      return;
    }
    const account = await signIn({ email: address, password, portal: role });
    setPassword("");
    onSignedIn?.(account);
    notify(`Welcome, ${account.name.split(" ")[0]}.`);
    goHome(account.role);
  }

  async function requestReset(event, data) {
    event.preventDefault();
    const address = campusEmail(String(data.get("resetEmail") || ""));
    if (!address.endsWith("@pvamu.edu")) {
      notifyError("Use your Prairie View A&M email address ending in @pvamu.edu.");
      return;
    }
    await sendPasswordReset(address);
    setResetSentTo(address);
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
          {!registration && !resetting && (
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
          <h1>{confirmationSentTo ? "Check your email" : title}</h1>
          {confirmationSentTo ? (
            <div className="stack">
              <p className="auth-intro">
                We sent a confirmation link to <strong>{confirmationSentTo}</strong>. Open it to
                finish creating your account, then sign in.
              </p>
              <Button className="button--full" onClick={() => navigate("/sign-in")}>
                Go to sign in
              </Button>
            </div>
          ) : (
            <>
              {registration && (
                <p className="auth-intro">
                  Use your real name and student ID so staff can match your ID card. We never ask
                  why you need food.
                </p>
              )}
              {resetting && (
                <p className="auth-intro">Enter a new password for your Panther Pantry account.</p>
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
                {!resetting && (
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
                )}
                <div className="auth-password">
                  <div className="auth-password-label">
                    <label htmlFor="password">{resetting ? "New password" : "Password"}</label>
                    {!registration && !resetting && (
                      <button
                        type="button"
                        className="text-link"
                        disabled={!!pending}
                        onClick={() => {
                          setResetSentTo("");
                          setForgot(true);
                        }}
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={registration || resetting ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      registration || resetting ? "At least 8 characters" : "Your password"
                    }
                    required
                    minLength={registration || resetting ? 8 : 1}
                  />
                </div>
                {resetting && (
                  <Field label="Confirm new password">
                    <input
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                    />
                  </Field>
                )}
                {registration && (
                  <div className="notice">
                    <Icon name="id" />
                    <p>Bring your student ID card to your first pickup. Staff check it once.</p>
                  </div>
                )}

                <Button
                  type="submit"
                  loadingLabel={
                    resetting
                      ? "Saving password…"
                      : registration
                        ? "Creating account…"
                        : "Signing in…"
                  }
                  className="button--full auth-submit"
                >
                  {resetting ? "Save new password" : registration ? "Create account" : "Sign in"}
                </Button>
              </AsyncForm>
              {registration ? (
                <p className="auth-sign-in">
                  Already have an account? <a href="#/sign-in">Sign in</a>
                </p>
              ) : (
                role === "student" &&
                !resetting && (
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
              {demoPassword && !registration && !resetting && (
                <div className="auth-mock-account">
                  <p>Local development: demo {role} account</p>
                  <span>demo.{role}@pvamu.edu</span>
                  <button
                    type="button"
                    className="text-link"
                    disabled={!!pending}
                    onClick={() => {
                      setEmail(`demo.${role}@pvamu.edu`);
                      setPassword(demoPassword);
                    }}
                  >
                    Use demo account
                  </button>
                </div>
              )}
            </>
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
          title="Reset your password"
          onClose={() => setForgot(false)}
          footer={
            resetSentTo ? (
              <Button onClick={() => setForgot(false)}>Back to sign in</Button>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setForgot(false)}>
                  Cancel
                </Button>
                <Button type="submit" form="password-reset-form" loadingLabel="Sending link…">
                  Send reset link
                </Button>
              </>
            )
          }
        >
          {resetSentTo ? (
            <p>
              If an account uses <strong>{resetSentTo}</strong>, we sent it a link to choose a new
              password. Open the link on this device.
            </p>
          ) : (
            <AsyncForm id="password-reset-form" className="stack" onSubmit={requestReset}>
              <p>Enter your campus email and we'll send you a link to choose a new password.</p>
              <Field label="Email">
                <input
                  name="resetEmail"
                  type="email"
                  autoComplete="username"
                  placeholder="name@pvamu.edu"
                  defaultValue={email}
                  required
                />
              </Field>
            </AsyncForm>
          )}
        </Modal>
      )}
    </main>
  );
}
