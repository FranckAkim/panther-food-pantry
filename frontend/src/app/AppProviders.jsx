import { HeroUIProvider } from "@heroui/system";
import { QueryClientProvider } from "@tanstack/react-query";
import { NotificationProvider } from "../components/Notifications.jsx";
import { LoadingProvider } from "../components/loading/LoadingProvider.jsx";
import { queryClient } from "../lib/queryClient.js";

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <NotificationProvider>
          <LoadingProvider>{children}</LoadingProvider>
        </NotificationProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
