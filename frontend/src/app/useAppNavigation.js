import { useState, useEffect } from "react";
import { getRoute, adminLinks, staffLinks, pageTitles } from "./routes.js";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { initialRequests } from "../features/operations/data.js";
import { adminUsersKey, initialAdminUsers } from "../features/admin/users/data.js";
import { notifySuccess } from "../components/Notifications.jsx";
import { matchesEmail } from "../features/admin/users/model.js";

export function useAppNavigation() {
  const [route, setRoute] = useState(getRoute);
  const [profile, setProfile] = usePersistedState("panther-demo-profile", null);
  const [requests] = usePersistedState("panther-staff-requests", initialRequests);
  const [adminUsers] = usePersistedState(adminUsersKey, initialAdminUsers);
  const [mobileMenu, setMobileMenu] = useState(false);
  const parts = route.split("?")[0].split("/").filter(Boolean);
  const area = parts[0];
  const portal = ["student", "staff", "admin"].includes(area) ? area : "student";
  const page = ["student", "staff", "admin"].includes(area)
    ? parts[1] || (portal === "student" ? "home" : "dashboard")
    : area || "sign-in";
  const authPage = page === "sign-in" || page === "register";
  const authenticated = profile?.role === portal;
  const navigationLinks = portal === "admin" ? adminLinks : staffLinks;
  const activeNav =
    {
      "request-detail": "requests",
      distribution: "pickups",
      "item-detail": "inventory",
      "student-profile": portal === "admin" ? "users" : "students",
      students: portal === "admin" ? "users" : "students",
      "pickup-slots": "slots",
    }[page] || page;
  const roleName = portal === "admin" ? "Admin" : "Staff";
  const waitingCount = requests.filter((request) => request.status === "Waiting").length;
  const notify = notifySuccess;
  function navigate(destination) {
    window.location.hash = destination;
    setMobileMenu(false);
  }
  function workspaceNavigate(destination) {
    navigate(portal === "admin" ? destination.replace(/^\/staff\//, "/admin/") : destination);
  }
  function signOut() {
    setProfile(null);
    navigate(portal === "student" ? "/sign-in" : `/${portal}/sign-in`);
    notify("You have signed out.");
  }
  useEffect(() => {
    const update = () => setRoute(getRoute());
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("hashchange", update);
    };
  }, []);
  useEffect(() => {
    document.title = `${authPage && portal !== "student" ? `${roleName} sign in` : pageTitles[page] || "Page not found"} · Panther Pantry`;
    window.scrollTo({ top: 0 });
    setMobileMenu(false);
  }, [route, page, portal, authPage, roleName]);
  useEffect(() => {
    if (!authPage && !authenticated && ["student", "staff", "admin"].includes(area))
      window.location.hash = portal === "student" ? "/sign-in" : `/${portal}/sign-in`;
  }, [area, authPage, authenticated, portal]);
  useEffect(() => {
    if (!profile) return;
    const managed = adminUsers.find((user) => matchesEmail(user, profile.email));
    if (managed && (!managed.active || managed.role !== profile.role)) {
      setProfile(null);
      navigate(`/${managed.role}/sign-in`);
      notify("Your account access changed. Please sign in again.");
    }
  }, [adminUsers, profile, setProfile]);
  useEffect(() => {
    if (portal === "admin" && page === "students") navigate("/admin/users");
  }, [portal, page]);

  return {
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
  };
}
