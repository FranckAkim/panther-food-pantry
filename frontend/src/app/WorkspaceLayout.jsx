import { adminPages } from "./routes.js";
import { AdminIcon } from "../components/AdminIcon.jsx";
import { Button } from "../components/ui/Button.jsx";
import { WorkspaceContent } from "./WorkspaceContent.jsx";

export function WorkspaceLayout({
  mobileMenu,
  setMobileMenu,
  portal,
  roleName,
  navigationLinks,
  activeNav,
  waitingCount,
  profile,
  signOut,
  page,
  contentProps,
  route,
  notFound,
}) {
  return (
    <div className="staff-shell">
      <div className="mobile-header">
        <button
          aria-label="Open navigation"
          aria-expanded={mobileMenu}
          onClick={() => setMobileMenu(true)}
        >
          ☰
        </button>
        <strong>Panther Pantry</strong>
      </div>
      {mobileMenu && (
        <button
          className="menu-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <aside className={`staff-sidebar ${mobileMenu ? "is-open" : ""}`}>
        <a className="staff-brand" href={`#/${portal}/dashboard`}>
          <span className="brand-mark">
            <img src="/assets/figma/nav-logo.svg" alt="" />
          </span>
          <span>
            <strong>Panther Pantry</strong>
            <small>{roleName}</small>
          </span>
        </a>
        <nav className="staff-nav" aria-label={`${roleName} menu`}>
          {navigationLinks.map(([key, title]) => (
            <a
              href={`#/${portal}/${key}`}
              key={key}
              aria-current={activeNav === key ? "page" : undefined}
              onClick={() => setMobileMenu(false)}
            >
              <>
                {adminPages.includes(key) ? (
                  <AdminIcon name={key} />
                ) : (
                  <img
                    src={`/assets/figma/nav-${key}${activeNav === key ? "-active" : ""}.svg`}
                    alt=""
                  />
                )}
              </>
              <span>{title}</span>
              {key === "requests" && waitingCount > 0 && (
                <span className="nav-count">{waitingCount}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="staff-account">
          <div className="staff-account-person">
            <span className="staff-avatar">
              {profile.name
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("")}
            </span>
            <span>
              <strong>{profile.name}</strong>
              <small>{portal === "admin" ? "Administrator" : "Pantry staff"}</small>
            </span>
          </div>
          <Button
            className="staff-signout"
            asyncAction
            loadingLabel="Signing out…"
            onClick={signOut}
          >
            <img src="/assets/figma/nav-sign-out.svg" alt="" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="staff-content" id="main-content" tabIndex={-1}>
        {
          <WorkspaceContent
            page={page}
            contentProps={contentProps}
            route={route}
            portal={portal}
            profile={profile}
            notFound={notFound}
          />
        }
      </main>
    </div>
  );
}
