import { createPortal } from 'react-dom';
import toast, { Toaster, ToastBar } from 'react-hot-toast';

export const notifySuccess = message => toast.success(message, { id: `success:${message}` });
export const notifyError = message => toast.error(message, {
  id: `error:${message}`,
  ariaProps: { role: 'alert', 'aria-live': 'assertive' },
});

export function NotificationProvider({ children }) {
  return <>
    {children}
    {/* React Aria keeps this notification layer accessible above modal overlays. */}
    {createPortal(<div data-react-aria-top-layer><Toaster position="top-center" toastOptions={{
      duration: 5000,
      style: { fontSize: '14px', maxWidth: 'min(480px, calc(100vw - 32px))', borderRadius: '12px', border: '1px solid var(--line)', color: 'var(--ink)' },
      success: { iconTheme: { primary: 'var(--success)', secondary: '#fff' } },
      error: { duration: 6000, iconTheme: { primary: 'var(--danger)', secondary: '#fff' } },
    }}>{notification => <ToastBar toast={notification}>
      {({ icon, message }) => <>{icon}{message}<button type="button" className="toast-dismiss" aria-label="Dismiss notification" onClick={() => toast.dismiss(notification.id)}>×</button></>}
    </ToastBar>}</Toaster></div>, document.body)}
  </>;
}
