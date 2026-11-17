import { useState } from "react";
import { adminPages } from "./routes.js";
import { AdminIcon } from "../components/AdminIcon.jsx";
import { Button } from "../components/ui/Button.jsx";
import { WorkspaceContent } from "./WorkspaceContent.jsx";
import { Avatar } from "../components/ui/Avatar.jsx";
import { ProfileDrawer } from "../components/ProfileDrawer.jsx";
import { useMyPhoto } from "../hooks/useProfilePhotos.js";

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
  notify,
  page,
  contentProps,
  route,
  notFound,
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const { url: photo } = useMyPhoto(profile.id);
  const roleLabel = portal === "admin" ? "Administrator" : "Pantry staff";
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
          <button
            type="button"
            className="staff-account-person"
            aria-haspopup="dialog"
            aria-label={`Your profile: ${profile.name}, ${roleLabel}`}
            onClick={() => {
              setMobileMenu(false);
              setProfileOpen(true);
            }}
          >
            <Avatar name={profile.name} src={photo} size="sm" className="staff-avatar" />
            <span>
              <strong>{profile.name}</strong>
              <small>{roleLabel}</small>
            </span>
          </button>
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
      {profileOpen && (
        <ProfileDrawer
          profile={profile}
          details={[["Role", roleLabel]]}
          photoHint="Other pantry staff and admins see your photo beside your name. Students don't see it."
          onClose={() => setProfileOpen(false)}
          notify={notify}
        />
      )}
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
