import { useId, useContext, useEffect } from "react";
import { usePendingAction, FormActionContext } from "../loading/ActionContext.js";
import { Spinner } from "../loading/Spinner.jsx";

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  asyncAction = false,
  loading = false,
  loadingLabel,
  onClick,
  disabled,
  ...props
}) {
  const id = useId();
  const action = usePendingAction();
  const formId = useContext(FormActionContext);
  const key = type === "submit" ? `form:${props.form || formId}` : id;
  const busy = loading || action?.pending === key;
  useEffect(
    () => () => {
      if (asyncAction) action?.cancel(id);
    },
    [asyncAction, action?.cancel, id],
  );
  return (
    <button
      {...props}
      type={type}
      className={`button button--${variant} ${className}`}
      disabled={disabled || busy || !!action?.pending}
      aria-busy={busy || undefined}
      onClick={
        asyncAction
          ? (event) => {
              event.preventDefault();
              action.run(key, () => onClick?.(event));
            }
          : onClick
      }
    >
      {busy && <Spinner />}
      {busy && loadingLabel ? loadingLabel : children}
    </button>
  );
}
