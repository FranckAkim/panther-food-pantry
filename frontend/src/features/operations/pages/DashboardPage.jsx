import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Asset } from "../components/Asset.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Status } from "../components/Status.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";

export function DashboardPage({
  walkInButton,
  navigate,
  waitingCount,
  textLink,
  dashboardPickups,
  lowStockItems,
  expiringLots,
  openDistribution,
}) {
  return (
    <>
      <PageHeading
        title="Dashboard"
        description="Wednesday, Oct 14, 2026"
        actions={
          <>
            {walkInButton}
            <Button onClick={() => navigate("/staff/donations/new")}>
              <Asset name="plus" />
              Record donation
            </Button>
          </>
        }
      />
      <section className="sr-stat-grid" aria-label="Today at a glance">
        <Card className="sr-stat">
          <span>Waiting for approval</span>
          <strong>{waitingCount}</strong>
          {textLink("Review requests", "/staff/requests")}
        </Card>
        <Card className="sr-stat">
          <span>Pickups today</span>
          <strong>{dashboardPickups.length}</strong>
          <p>
            {dashboardPickups.filter((p) => p.status === "Completed").length} done ·{" "}
            {dashboardPickups.filter((p) => p.status === "Approved").length} to go
          </p>
        </Card>
        <Card className="sr-stat">
          <span>Low-stock items</span>
          <strong>{lowStockItems.length}</strong>
          {textLink("View inventory", "/staff/inventory")}
        </Card>
        <Card className="sr-stat">
          <span>Lots expiring in 7 days</span>
          <strong>{expiringLots.length}</strong>
          {textLink("See which lots", "/staff/inventory?filter=expiring")}
        </Card>
      </section>
      <div className="sr-dashboard-columns">
        <Card className="sr-dashboard-pickups">
          <div className="sr-card-heading">
            <h2>Today's pickups</h2>
            {textLink("Open list", "/staff/pickups")}
          </div>
          <ul className="sr-pickup-summary">
            {dashboardPickups.map((pickup) => (
              <li key={pickup.id}>
                <time>{pickup.time || "Walk-in"}</time>
                <button
                  className="sr-person-link"
                  onClick={() =>
                    pickup.status === "Approved"
                      ? openDistribution(pickup)
                      : navigate("/staff/pickups")
                  }
                >
                  {pickup.name}
                </button>
                <Status status={pickup.status} />
              </li>
            ))}
          </ul>
        </Card>
        <div className="sr-dashboard-side">
          <Card>
            <h2>Low stock</h2>
            <div className="sr-mini-table-wrap">
              <table className="sr-mini-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="sr-number">On hand</th>
                    <th className="sr-number">Alert at</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockItems
                    .sort(
                      (a, b) =>
                        a.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0) -
                        b.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0),
                    )
                    .map((item) => [
                      item.name,
                      `${item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0)} ${item.unit}`,
                      item.alert,
                    ])
                    .map((row) => (
                      <tr key={row[0]}>
                        <td>{row[0]}</td>
                        <td className="sr-number">{row[1]}</td>
                        <td className="sr-number muted">{row[2]}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <h2>Expiring soon</h2>
            <div className="sr-mini-table-wrap">
              <table className="sr-mini-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="sr-number">Qty</th>
                    <th>Expires</th>
                    <th>Shelf</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringLots
                    .sort((a, b) => a.expiry.localeCompare(b.expiry))
                    .map((lot) => [
                      lot.itemName,
                      `${lot.quantity} ${lot.unit}`,
                      new Date(`${lot.expiry}T12:00:00`).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      }),
                      lot.shelf,
                    ])
                    .map((row) => (
                      <tr key={row[0]}>
                        <td>{row[0]}</td>
                        <td className="sr-number">{row[1]}</td>
                        <td>
                          <Badge tone="orange">{row[2]}</Badge>
                        </td>
                        <td>{row[3]}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
