import { useReducedMotion } from "framer-motion";
import { usePendingAction } from "../loading/ActionContext.js";
import {
  Modal as HeroModal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

export function Modal({ title, children, onClose, footer }) {
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
      placement="center"
      size="xl"
      backdrop="blur"
      scrollBehavior="inside"
      disableAnimation={!!reducedMotion}
      classNames={{
        base: "pantry-modal",
        header: "pantry-modal-header",
        body: "pantry-modal-body",
        footer: "pantry-modal-footer",
        closeButton: "pantry-modal-close",
      }}
    >
      <ModalContent>
        <ModalHeader as="h2">{title}</ModalHeader>
        <ModalBody>
          <fieldset className="loading-fields" disabled={!!pending}>
            {children}
          </fieldset>
        </ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </HeroModal>
  );
}
