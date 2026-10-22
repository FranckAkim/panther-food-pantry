import { createClient } from "@supabase/supabase-js";
import { createPantryApi } from "./pantryApi";

let api;
export function getPantryApi() {
  if (api) return api;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Set the Supabase variables in frontend/.env first.");
  api = createPantryApi(createClient(url, key));
  return api;
}
