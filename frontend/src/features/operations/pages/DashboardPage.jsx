import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Asset } from "../components/Asset.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Status } from "../components/Status.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";
import { longDateLabel, shortDate } from "../../../api/time.js";
import { AccountAvatar } from "../../../components/AccountAvatar.jsx";

export function DashboardPage({
  today,
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
        description={longDateLabel(today)}
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
          {!dashboardPickups.length ? (
            <p className="sr-card-empty muted">No pickups are booked for today.</p>
          ) : (
            <ul className="sr-pickup-summary">
              {dashboardPickups.map((pickup) => (
                <li key={pickup.id}>
                  <time>{pickup.time || "Walk-in"}</time>
                  <button
                    className="sr-person-link person-cell"
                    onClick={() =>
                      pickup.status === "Approved"
                        ? openDistribution(pickup)
                        : navigate("/staff/pickups")
                    }
                  >
                    <AccountAvatar profileId={pickup.recipientId} name={pickup.name} />
                    {pickup.name}
                  </button>
                  <Status status={pickup.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="sr-dashboard-side">
          <Card>
            <h2>Low stock</h2>
            {!lowStockItems.length ? (
              <p className="sr-card-empty muted">Every item is above its alert level.</p>
            ) : (
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
                    {[...lowStockItems]
                      .sort((a, b) => a.available - b.available)
                      .map((item) => (
                        <tr key={item.id}>
                          <td>{item.name}</td>
                          <td className="sr-number">
                            {item.available} {item.unit}
                          </td>
                          <td className="sr-number muted">{item.alert}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <h2>Expiring soon</h2>
            {!expiringLots.length ? (
              <p className="sr-card-empty muted">No lots expire in the next 7 days.</p>
            ) : (
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
                    {[...expiringLots]
                      .sort((a, b) => a.expiry.localeCompare(b.expiry))
                      .map((lot) => (
                        <tr key={lot.id}>
                          <td>{lot.itemName}</td>
                          <td className="sr-number">
                            {lot.quantity} {lot.unit}
                          </td>
                          <td>
                            <Badge tone="orange">{shortDate(lot.expiry, false)}</Badge>
                          </td>
                          <td>{lot.shelf}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
