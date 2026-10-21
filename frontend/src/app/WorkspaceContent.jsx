import { WalkIn } from "../features/walk-in/WalkInPage.jsx";
import { DataLoader } from "../components/loading/DataLoader.jsx";
import { pageTitles, adminPages, operationsPages, stockPages } from "./routes.js";
import { Admin } from "../features/admin/AdminPages.jsx";
import { StaffRequests } from "../features/operations/OperationsPages.jsx";
import { StaffInventory } from "../features/stock/StockPages.jsx";

export function WorkspaceContent({ page, contentProps, route, portal, profile, notFound }) {
  return page === "walk-in" ? (
    <WalkIn {...contentProps} />
  ) : (
    <DataLoader queryKey={route} label={`Loading ${(pageTitles[page] || "page").toLowerCase()}…`}>
      {portal === "admin" && adminPages.includes(page) ? (
        <Admin page={page} profile={profile} {...contentProps} />
      ) : operationsPages.includes(page) ? (
        <StaffRequests page={page} {...contentProps} />
      ) : stockPages.includes(page) ? (
        <StaffInventory page={page} {...contentProps} />
      ) : (
        notFound
      )}
    </DataLoader>
  );
}
