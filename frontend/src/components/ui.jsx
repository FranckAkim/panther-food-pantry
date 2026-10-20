import { useContext, useEffect, useId } from "react";
import { FormActionContext, Spinner, usePendingAction } from "./Loading.jsx";
import { Modal as HeroModal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { useReducedMotion } from "framer-motion";

const iconAssets = {
  search: "/assets/staff-search.svg", plus: "/assets/staff-plus.svg",
  close: "/assets/staff-close.svg", x: "/assets/staff-close.svg",
  check: "/assets/staff-checked.svg", "check-circle": "/assets/staff-checked.svg",
  "chevron-left": "/assets/staff-previous.svg", "arrow-left": "/assets/staff-previous.svg",
  "chevron-right": "/assets/staff-next.svg", "arrow-right": "/assets/staff-next.svg",
  trash: "/assets/staff-remove.svg", remove: "/assets/staff-remove.svg",
  info: "/assets/figma/2ffd3.svg", id: "/assets/figma/d720d.svg",
};

export function Icon({ name, size = 20, className = "" }) {
  const src = iconAssets[name] || `/assets/figma/nav-${name}.svg`;
  return <span className={`icon ${className}`} style={{ width: size, height: size }} aria-hidden="true"><img src={src} alt="" /></span>;
}

export function Button({ variant = "primary", className = "", children, type = "button", asyncAction = false, loading = false, loadingLabel, onClick, disabled, ...props }) {
  const id = useId();
  const action = usePendingAction();
  const formId = useContext(FormActionContext);
  const key = type === 'submit' ? `form:${props.form || formId}` : id;
  const busy = loading || action?.pending === key;
  useEffect(() => () => { if (asyncAction) action?.cancel(id); }, [asyncAction, action?.cancel, id]);
  return <button {...props} type={type} className={`button button--${variant} ${className}`} disabled={disabled || busy || !!action?.pending} aria-busy={busy || undefined} onClick={asyncAction ? event => {
    event.preventDefault();
    action.run(key, () => onClick?.(event));
  } : onClick}>{busy && <Spinner />}{busy && loadingLabel ? loadingLabel : children}</button>;
}

export function AsyncForm({ children, onSubmit, id, ...props }) {
  const generatedId = useId();
  const formId = id || generatedId;
  const key = `form:${formId}`;
  const action = usePendingAction();
  const busy = action.pending === key;
  useEffect(() => () => action.cancel(key), [action.cancel, key]);
  return <FormActionContext.Provider value={formId}><form {...props} id={formId} aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    // Capture before disabling the fields, including submissions from modal footers.
    const form = event.currentTarget;
    const data = new FormData(form);
    action.run(key, signal => onSubmit({ currentTarget: form, target: form, preventDefault() {}, signal }, data));
  }}><fieldset className="loading-fields" disabled={!!action.pending}>{children}</fieldset></form></FormActionContext.Provider>;
}

export function Badge({ children, tone, className = "" }) {
  const text = typeof children === "string" ? children.toLowerCase() : "";
  const inferred = /declined|no-show|out of stock|inactive/.test(text) ? "danger" : /approved|completed|in stock|active|verified/.test(text) ? "success" : /pending|submitted|low stock|expir|first visit|provisional/.test(text) ? "warning" : "neutral";
  return <span className={`badge badge--${tone || inferred} ${className}`}>{children}</span>;
}

export function Field({ label, hint, children, className = "" }) {
  return <label className={`field ${className}`}><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function Card({ children, className = "", ...props }) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function PageHeading({ title, description, actions }) {
  return <header className="page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="heading-actions">{actions}</div>}</header>;
}

export function EmptyState({ title, description }) {
  return <div className="empty-state"><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}

export function Modal({ title, children, onClose, footer }) {
  const reducedMotion = useReducedMotion();
  const { pending } = usePendingAction();
  return <HeroModal isOpen onClose={() => { if (!pending) onClose(); }} isDismissable={!pending} isKeyboardDismissDisabled={!!pending} hideCloseButton={!!pending} placement="center" size="xl" backdrop="blur" scrollBehavior="inside" disableAnimation={!!reducedMotion} classNames={{
    base: 'pantry-modal', header: 'pantry-modal-header', body: 'pantry-modal-body',
    footer: 'pantry-modal-footer', closeButton: 'pantry-modal-close',
  }}>
    <ModalContent>
      <ModalHeader as="h2">{title}</ModalHeader>
      <ModalBody><fieldset className="loading-fields" disabled={!!pending}>{children}</fieldset></ModalBody>
      {footer && <ModalFooter>{footer}</ModalFooter>}
    </ModalContent>
  </HeroModal>;
}
