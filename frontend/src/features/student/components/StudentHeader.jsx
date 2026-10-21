import { Button } from "../../../components/ui/Button.jsx";

export function StudentHeader({ page, accountOpen, setAccountOpen, initials, profile, signOut }) {
  return (
    <header className="student-header">
      <div className="student-header-inner">
        <a className="student-brand" href="#/student/home">
          <span>
            <img src="/assets/figma/c61c4.svg" alt="" />
          </span>
          <strong>Panther Pantry</strong>
        </a>
        <nav aria-label="Main">
          {[
            ["home", "Home"],
            ["request", "Request food"],
            ["history", "History"],
          ].map(([path, label]) => (
            <a
              href={`#/student/${path}`}
              key={path}
              aria-current={
                page === path || (path === "request" && page === "request-status")
                  ? "page"
                  : undefined
              }
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="student-account">
          <button
            className="student-avatar"
            aria-label="Account and sign out"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(!accountOpen)}
          >
            {initials}
          </button>
          {accountOpen && (
            <div className="student-account-menu">
              <strong>{profile.name}</strong>
              <span>{profile.studentId}</span>
              <Button asyncAction loadingLabel="Signing out…" onClick={signOut}>
                Sign out
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
