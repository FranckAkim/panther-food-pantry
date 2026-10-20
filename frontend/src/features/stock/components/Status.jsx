import { lowStock, expiresSoon } from "../utils/inventory.js";
import { Badge } from "../../../components/ui/Badge.jsx";

export function Status({ item }) {
  return (
    <span className="stock-status">
      {lowStock(item) && <Badge tone="warning">Low stock</Badge>}
      {expiresSoon(item) && <span className="stock-badge stock-badge-orange">Expires soon</span>}
      {!lowStock(item) && !expiresSoon(item) && <Badge tone="success">In stock</Badge>}
    </span>
  );
}
