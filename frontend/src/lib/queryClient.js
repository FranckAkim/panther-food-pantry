import { QueryClient, useQueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refetch whenever a page opens: other staff and students change this data too.
      staleTime: 0,
      retry: (failures, error) => failures < 2 && !["42501", "PGRST301"].includes(error?.code),
      refetchOnWindowFocus: true,
    },
  },
});

/** Returns a function that refetches every query under the given key prefixes. */
export function useRefresh() {
  const client = useQueryClient();
  return (prefixes) =>
    Promise.all(prefixes.map((queryKey) => client.invalidateQueries({ queryKey })));
}
