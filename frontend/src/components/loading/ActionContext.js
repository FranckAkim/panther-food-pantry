import { createContext, useContext } from "react";

export const ActionContext = createContext(null);

export const FormActionContext = createContext(null);

export const usePendingAction = () => useContext(ActionContext);
