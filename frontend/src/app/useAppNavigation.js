import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRoute, adminLinks, staffLinks, pageTitles } from "./routes.js";
import { notifyError, notifySuccess } from "../components/Notifications.jsx";
import { useSession } from "../features/auth/useSession.js";
import { signOut as endSession } from "../api/auth.js";
import { fetchStaffRequests } from "../api/requests.js";
import { keys } from "../api/keys.js";

const portals = ["student", "staff", "admin"];
export const homeFor = (role) => (role === "student" ? "/student/home" : `/${role}/dashboard`);
export const signInFor = (portal) => (portal === "student" ? "/sign-in" : `/${portal}/sign-in`);

export function useAppNavigation() {
  const [route, setRoute] = useState(getRoute);
  const queryClient = useQueryClient();
  const session = useSession();
  const profile = session.account;
  const ready = session.status === "ready";
  const [mobileMenu, setMobileMenu] = useState(false);
  const parts = route.split("?")[0].split("/").filter(Boolean);
  const area = parts[0];
  const portal = portals.includes(area) ? area : "student";
  const page = portals.includes(area)
    ? parts[1] || (portal === "student" ? "home" : "dashboard")
    : area || "sign-in";
  const authPage = page === "sign-in" || page === "register";
  const authenticated = Boolean(profile) && profile.role === portal;
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
  const workspace = authenticated && portal !== "student";
  const requests = useQuery({
    queryKey: keys.requests,
    queryFn: fetchStaffRequests,
    enabled: workspace,
    refetchInterval: 60_000,
  });
  const waitingCount = (requests.data || []).filter((r) => r.dbStatus === "submitted").length;
  const notify = notifySuccess;
  function navigate(destination) {
    window.location.hash = destination;
    setMobileMenu(false);
  }
  function workspaceNavigate(destination) {
    navigate(portal === "admin" ? destination.replace(/^\/staff\//, "/admin/") : destination);
  }
  async function signOut() {
    try {
      await endSession();
    } catch (error) {
      notifyError(error.message);
      return;
    }
    navigate(signInFor(portal));
    notify("You have signed out.");
  }
  useEffect(() => {
    const update = () => {
      setRoute(getRoute());
      // Pages share mounted queries, so refresh what is on screen after each navigation.
      queryClient.invalidateQueries({ refetchType: "active" });
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, [queryClient]);
  useEffect(() => {
    document.title = `${authPage && portal !== "student" ? `${roleName} sign in` : pageTitles[page] || "Page not found"} · Panther Pantry`;
    window.scrollTo({ top: 0 });
    setMobileMenu(false);
  }, [route, page, portal, authPage, roleName]);
  // The redirects below run after render. If the address has changed since (a newer navigation
  // is pending), they must not act on the old page and undo it.
  const current = () => getRoute() === route;
  // Signed-out visitors go to the sign-in page for the portal they asked for.
  useEffect(() => {
    if (ready && !authPage && !authenticated && portals.includes(area) && current())
      window.location.hash = signInFor(portal);
  }, [ready, area, authPage, authenticated, portal, route]);
  // Someone already signed in to this portal skips its sign-in page (e.g. after an email link).
  useEffect(() => {
    if (!ready || !profile || session.recovery || !authPage || !current()) return;
    if (profile.role === (page === "register" ? "student" : portal))
      window.location.hash = homeFor(profile.role);
  }, [ready, profile, session.recovery, authPage, page, portal, route]);
  useEffect(() => {
    if (portal === "admin" && page === "students") navigate("/admin/users");
  }, [portal, page]);

  return {
    ready,
    recovery: session.recovery,
    finishRecovery: session.finishRecovery,
    signedIn: session.signedIn,
    workspaceNavigate,
    notify,
    navigate,
    profile,
    authPage,
    authenticated,
    portal,
    page,
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
