import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase/client.js";
import { fetchAccount } from "../../api/auth.js";
import { notifyError } from "../../components/Notifications.jsx";

/**
 * Tracks the Supabase session and the signed-in account's pantry role.
 * status: "loading" until the stored session has been checked.
 * recovery: true after following a password-reset link, until a new password is saved.
 */
export function useSession() {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: "loading", account: null, recovery: false });

  useEffect(() => {
    let active = true;
    async function load(recovery) {
      try {
        const account = await fetchAccount();
        if (!active) return;
        if (account && !account.enabled) {
          await supabase.auth.signOut();
          notifyError("This account is inactive. Contact a pantry administrator.");
          return;
        }
        setState((current) => ({
          status: "ready",
          account,
          recovery: recovery ?? current.recovery,
        }));
      } catch (error) {
        if (!active) return;
        notifyError(error.message);
        setState({ status: "ready", account: null, recovery: false });
      }
    }
    load(false);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Supabase advises against awaiting its calls inside this callback; defer instead.
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        setState({ status: "ready", account: null, recovery: false });
      } else if (event === "PASSWORD_RECOVERY") {
        setTimeout(() => load(true), 0);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setTimeout(() => load(undefined), 0);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const finishRecovery = () => setState((current) => ({ ...current, recovery: false }));
  // The sign-in form already has the account; storing it before navigating keeps the
  // signed-out redirect from bouncing back to sign-in while the SIGNED_IN reload runs.
  const signedIn = (account) => setState((current) => ({ ...current, status: "ready", account }));
  return { ...state, finishRecovery, signedIn };
}
