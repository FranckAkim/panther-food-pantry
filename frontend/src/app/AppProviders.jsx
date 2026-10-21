import { HeroUIProvider } from "@heroui/system";
import { NotificationProvider } from "../components/Notifications.jsx";
import { LoadingProvider } from "../components/loading/LoadingProvider.jsx";

export function AppProviders({ children }) {
  return (
    <HeroUIProvider>
      <NotificationProvider>
        <LoadingProvider>{children}</LoadingProvider>
      </NotificationProvider>
    </HeroUIProvider>
  );
}
