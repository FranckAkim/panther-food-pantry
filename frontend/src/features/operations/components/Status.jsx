import { Badge } from "../../../components/ui/Badge.jsx";

const toneFor = (status) =>
  ({
    Approved: "blue",
    Completed: "green",
    Waiting: "gold",
    Declined: "red",
    "No-show": "orange",
  })[status] || "neutral";

export const Status = ({ status }) => <Badge tone={toneFor(status)}>{status}</Badge>;
