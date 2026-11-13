// Turns Supabase and network errors into messages the screens can show.
const NETWORK = /Failed to fetch|NetworkError|Load failed|fetch failed/i;
// Raw database wording that should never reach the screen.
const INTERNAL =
  /violates|constraint|syntax error|relation .* does not exist|column .* does not exist/i;

/** Converts a Supabase or network error into an Error whose message the UI can show. */
export function toUserError(error) {
  const message = error?.message || "";
  let text = message;
  if (!message) text = "Something went wrong. Please try again.";
  else if (error.name === "TypeError" || NETWORK.test(message))
    text = "We couldn't reach the pantry server. Check your connection and try again.";
  else if (error.code === "PGRST301" || /jwt expired|invalid jwt/i.test(message))
    text = "Your session has expired. Please sign in again.";
  else if (error.code === "42501" && /permission denied/i.test(message))
    text = "Your account doesn't have access to this. Ask a pantry administrator if you need it.";
  else if (INTERNAL.test(message)) text = "Something went wrong saving this. Please try again.";
  if (text !== message) console.error(error);
  return Object.assign(new Error(text), { code: error?.code, cause: error });
}
