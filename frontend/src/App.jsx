import { DataLoader } from "./components/Loading.jsx";
import { notifySuccess } from "./components/Notifications.jsx";
import { useEffect, useState } from "react";
import { Button, Card, PageHeading } from "./components/ui.jsx";
import { usePersistedState } from "./hooks/usePersistedState.js";
import Auth from "./pages/Auth.jsx";
import Student from "./pages/Student.jsx";
import StaffRequests, { initialRequests } from "./pages/StaffRequests.jsx";
import StaffInventory from "./pages/StaffInventory.jsx";
import Admin from "./pages/Admin.jsx";
import AdminIcon from "./components/AdminIcon.jsx";
import { adminUsersKey, initialAdminUsers, matchesEmail } from "./data/admin.js";
import WalkIn from "./pages/WalkIn.jsx";
import "./styles.css";

const staffLinks = [["dashboard", "Dashboard"], ["requests", "Requests"], ["pickups", "Today's pickups"], ["walk-in", "Walk-in"], ["inventory", "Inventory"], ["donations", "Donations"], ["students", "Students"], ["slots", "Pickup slots"]];
const adminPages = ["reports", "users", "audit-log"];
const adminLinks = [...staffLinks.filter(([key]) => key !== "students"), ["reports", "Reports"], ["users", "Users"], ["audit-log", "Audit log"]];
const operationsPages = ["dashboard", "requests", "request-detail", "pickups", "distribution"];
const stockPages = ["inventory", "item-detail", "donations", "students", "student-profile", "slots", "pickup-slots"];
const pageTitles = { "sign-in": "Sign in", register: "Create account", home: "Home", request: "Request food", history: "History", "request-status": "Your request", ...Object.fromEntries(staffLinks), ...Object.fromEntries(adminLinks), "item-detail": "Item details", "student-profile": "Student profile", distribution: "Hand out food", "request-detail": "Request details" };
const getRoute = () => window.location.hash.slice(1) || "/sign-in";

export default function App() {
  const [route, setRoute] = useState(getRoute);
  const [profile, setProfile] = usePersistedState("panther-demo-profile", null);
  const [requests] = usePersistedState("panther-staff-requests", initialRequests);
  const [adminUsers] = usePersistedState(adminUsersKey, initialAdminUsers);
  const [mobileMenu, setMobileMenu] = useState(false);
  const parts = route.split("?")[0].split("/").filter(Boolean);
  const area = parts[0];
  const portal = ["student", "staff", "admin"].includes(area) ? area : "student";
  const page = ["student", "staff", "admin"].includes(area) ? parts[1] || (portal === "student" ? "home" : "dashboard") : area || "sign-in";
  const authPage = page === "sign-in" || page === "register";
  const authenticated = profile?.role === portal;
  const navigationLinks = portal === "admin" ? adminLinks : staffLinks;
  const activeNav = ({ "request-detail": "requests", distribution: "pickups", "item-detail": "inventory", "student-profile": portal === "admin" ? "users" : "students", students: portal === "admin" ? "users" : "students", "pickup-slots": "slots" })[page] || page;
  const roleName = portal === "admin" ? "Admin" : "Staff";
  const waitingCount = requests.filter(request => request.status === "Waiting").length;
  const notify = notifySuccess;
  function navigate(destination) { window.location.hash = destination; setMobileMenu(false); }
  function workspaceNavigate(destination) { navigate(portal === "admin" ? destination.replace(/^\/staff\//, "/admin/") : destination); }
  function signOut() { setProfile(null); navigate(portal === "student" ? "/sign-in" : `/${portal}/sign-in`); notify("You have signed out."); }
  useEffect(() => { const update = () => setRoute(getRoute()); window.addEventListener("hashchange", update); return () => { window.removeEventListener("hashchange", update); }; }, []);
  useEffect(() => { document.title = `${authPage && portal !== "student" ? `${roleName} sign in` : pageTitles[page] || "Page not found"} · Panther Pantry`; window.scrollTo({ top: 0 }); setMobileMenu(false); }, [route, page, portal, authPage, roleName]);
  useEffect(() => { if (!authPage && !authenticated && ["student", "staff", "admin"].includes(area)) window.location.hash = portal === "student" ? "/sign-in" : `/${portal}/sign-in`; }, [area, authPage, authenticated, portal]);
  useEffect(() => {
    if (!profile) return;
    const managed = adminUsers.find(user => matchesEmail(user, profile.email));
    if (managed && (!managed.active || managed.role !== profile.role)) {
      setProfile(null);
      navigate(`/${managed.role}/sign-in`);
      notify("Your account access changed. Please sign in again.");
    }
  }, [adminUsers, profile, setProfile]);
  useEffect(() => { if (portal === 'admin' && page === 'students') navigate('/admin/users'); }, [portal, page]);
  const contentProps = { navigate: workspaceNavigate, notify };
  const notFound = <div className="unavailable-screen"><PageHeading title="Page not found" /><Card className="stack"><p>This page isn't available. Use the menu to return to the pantry.</p><Button onClick={() => navigate(profile ? profile.role === "student" ? "/student/home" : `/${profile.role}/dashboard` : "/sign-in")}>Go home</Button></Card></div>;

  return <>
    <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
    {authPage || !authenticated ? <Auth key={`${portal}-${page}`} page={page === "register" ? "register" : "sign-in"} role={page === "register" ? "student" : portal} navigate={navigate} notify={notify} onSignIn={setProfile} /> : area === "student" && ["home", "request", "history", "request-status"].includes(page) ? <Student page={page} navigate={navigate} notify={notify} profile={profile} signOut={signOut} /> : ["staff", "admin"].includes(area) ? <div className="staff-shell">
      <div className="mobile-header"><button aria-label="Open navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)}>☰</button><strong>Panther Pantry</strong></div>
      {mobileMenu && <button className="menu-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <aside className={`staff-sidebar ${mobileMenu ? "is-open" : ""}`}>
        <a className="staff-brand" href={`#/${portal}/dashboard`}><span className="brand-mark"><img src="/assets/figma/nav-logo.svg" alt="" /></span><span><strong>Panther Pantry</strong><small>{roleName}</small></span></a>
        <nav className="staff-nav" aria-label={`${roleName} menu`}>{navigationLinks.map(([key, title]) => <a href={`#/${portal}/${key}`} key={key} aria-current={activeNav === key ? "page" : undefined} onClick={() => setMobileMenu(false)}><>{adminPages.includes(key) ? <AdminIcon name={key} /> : <img src={`/assets/figma/nav-${key}${activeNav === key ? "-active" : ""}.svg`} alt="" />}</><span>{title}</span>{key === "requests" && waitingCount > 0 && <span className="nav-count">{waitingCount}</span>}</a>)}</nav>
        <div className="staff-account"><div className="staff-account-person"><span className="staff-avatar">{profile.name.split(" ").map(word => word[0]).slice(0, 2).join("")}</span><span><strong>{profile.name}</strong><small>{portal === "admin" ? "Administrator" : "Pantry staff"}</small></span></div><Button className="staff-signout" asyncAction loadingLabel="Signing out…" onClick={signOut}><img src="/assets/figma/nav-sign-out.svg" alt="" />Sign out</Button></div>
      </aside>
      <main className="staff-content" id="main-content" tabIndex={-1}>{page === "walk-in" ? <WalkIn {...contentProps} /> : <DataLoader queryKey={route} label={`Loading ${(pageTitles[page] || "page").toLowerCase()}…`}>{portal === "admin" && adminPages.includes(page) ? <Admin page={page} profile={profile} {...contentProps} /> : operationsPages.includes(page) ? <StaffRequests page={page} {...contentProps} /> : stockPages.includes(page) ? <StaffInventory page={page} {...contentProps} /> : notFound}</DataLoader>}</main>
    </div> : <main id="main-content" tabIndex={-1}>{notFound}</main>}
  </>;
}
