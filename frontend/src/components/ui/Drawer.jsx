import { useReducedMotion } from "framer-motion";
import { usePendingAction } from "../loading/ActionContext.js";
import {
  Modal as HeroModal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

// HeroUI's modal (focus trap, Escape, close button) shown as a full-height panel on the right.
const slideIn = {
  variants: {
    enter: { x: 0, opacity: 1, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
    exit: { x: 56, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } },
  },
};

/** A side panel that slides in from the right, such as the student's profile. */
export function Drawer({ title, children, onClose, footer }) {
  const reducedMotion = useReducedMotion();
  const { pending } = usePendingAction();
  return (
    <HeroModal
      isOpen
      onClose={() => {
        if (!pending) onClose();
      }}
      isDismissable={!pending}
      isKeyboardDismissDisabled={!!pending}
      hideCloseButton={!!pending}
      backdrop="opaque"
      scrollBehavior="inside"
      disableAnimation={!!reducedMotion}
      motionProps={slideIn}
      classNames={{
        wrapper: "pantry-drawer-wrapper",
        base: "pantry-modal pantry-drawer",
        header: "pantry-modal-header",
        body: "pantry-modal-body pantry-drawer-body",
        footer: "pantry-modal-footer pantry-drawer-footer",
        closeButton: "pantry-modal-close",
      }}
    >
      <ModalContent>
        <ModalHeader as="h2">{title}</ModalHeader>
        <ModalBody>{children}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </HeroModal>
  );
}
