import { useAppNavigation } from "./useAppNavigation.js";
import { PageHeading } from "../components/ui/PageHeading.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Auth } from "../features/auth/AuthPage.jsx";
import { Student } from "../features/student/StudentPortal.jsx";
import { WorkspaceLayout } from "./WorkspaceLayout.jsx";

// Keep the original stylesheet order: feature overrides depend on this cascade.
import "../features/student/student.css";
import "../features/stock/stock.css";
import "../features/operations/operations.css";
import "../features/admin/admin.css";
import "../features/walk-in/walk-in.css";
import "../styles.css";

export function App() {
  const {
    workspaceNavigate,
    notify,
    navigate,
    profile,
    authPage,
    authenticated,
    portal,
    page,
    setProfile,
    area,
    signOut,
    mobileMenu,
    setMobileMenu,
    roleName,
    navigationLinks,
    activeNav,
    waitingCount,
    route,
  } = useAppNavigation();
  const contentProps = { navigate: workspaceNavigate, notify };
  const notFound = (
    <div className="unavailable-screen">
      <PageHeading title="Page not found" />
      <Card className="stack">
        <p>This page isn't available. Use the menu to return to the pantry.</p>
        <Button
          onClick={() =>
            navigate(
              profile
                ? profile.role === "student"
                  ? "/student/home"
                  : `/${profile.role}/dashboard`
                : "/sign-in",
            )
          }
        >
          Go home
        </Button>
      </Card>
    </div>
  );

  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {authPage || !authenticated ? (
        <Auth
          key={`${portal}-${page}`}
          page={page === "register" ? "register" : "sign-in"}
          role={page === "register" ? "student" : portal}
          navigate={navigate}
          notify={notify}
          onSignIn={setProfile}
        />
      ) : area === "student" && ["home", "request", "history", "request-status"].includes(page) ? (
        <Student
          page={page}
          navigate={navigate}
          notify={notify}
          profile={profile}
          signOut={signOut}
        />
      ) : ["staff", "admin"].includes(area) ? (
        <WorkspaceLayout
          mobileMenu={mobileMenu}
          setMobileMenu={setMobileMenu}
          portal={portal}
          roleName={roleName}
          navigationLinks={navigationLinks}
          activeNav={activeNav}
          waitingCount={waitingCount}
          profile={profile}
          signOut={signOut}
          page={page}
          contentProps={contentProps}
          route={route}
          notFound={notFound}
        />
      ) : (
        <main id="main-content" tabIndex={-1}>
          {notFound}
        </main>
      )}
    </>
  );
}

export default App;
