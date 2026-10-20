import { useId, useEffect } from "react";
import { usePendingAction, FormActionContext } from "../loading/ActionContext.js";

export function AsyncForm({ children, onSubmit, id, ...props }) {
  const generatedId = useId();
  const formId = id || generatedId;
  const key = `form:${formId}`;
  const action = usePendingAction();
  const busy = action.pending === key;
  useEffect(() => () => action.cancel(key), [action.cancel, key]);
  return (
    <FormActionContext.Provider value={formId}>
      <form
        {...props}
        id={formId}
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          // Capture before disabling the fields, including submissions from modal footers.
          const form = event.currentTarget;
          const data = new FormData(form);
          action.run(key, (signal) =>
            onSubmit(
              {
                currentTarget: form,
                target: form,
                preventDefault() {},
                signal,
              },
              data,
            ),
          );
        }}
      >
        <fieldset className="loading-fields" disabled={!!action.pending}>
          {children}
        </fieldset>
      </form>
    </FormActionContext.Provider>
  );
}
