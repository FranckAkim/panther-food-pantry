import { supabase } from "../lib/supabase/client.js";
import { toUserError } from "./errors.js";

/** Calls a database function and returns its data, throwing a user-facing error on failure. */
export async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw toUserError(error);
  return data;
}

/** Awaits a query builder and returns its data, throwing a user-facing error on failure. */
export async function run(builder) {
  const { data, error } = await builder;
  if (error) throw toUserError(error);
  return data;
}

export { supabase, toUserError };
