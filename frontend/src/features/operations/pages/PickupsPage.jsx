import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Asset } from "../components/Asset.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Status } from "../components/Status.jsx";
import { longDateLabel } from "../../../api/time.js";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { AccountAvatar } from "../../../components/AccountAvatar.jsx";

export function PickupsPage({
  pickupDate,
  pickupsQuery,
  dayOffset,
  dayPickups,
  doneCount,
  pendingCount,
  setDayOffset,
  walkInButton,
  openDistribution,
  setNoShowPickup,
}) {
  return (
    <>
      <PageHeading
        title={dayOffset === 0 ? "Today's pickups" : "Pickups"}
        description={`${longDateLabel(pickupDate)}${dayPickups.length ? ` · ${doneCount} done · ${pendingCount} to go` : ""}`}
        actions={
          <>
            <div className="sr-day-controls">
              <Button
                variant="secondary"
                aria-label="Previous day"
                onClick={() => setDayOffset((day) => day - 1)}
              >
                <Asset name="previous" />
              </Button>
              <Button
                variant="secondary"
                aria-label="Next day"
                onClick={() => setDayOffset((day) => day + 1)}
              >
                <Asset name="next" />
              </Button>
            </div>
            {walkInButton}
          </>
        }
      />
      <DataLoader queries={pickupsQuery} label="Loading pickups…">
        {dayPickups.length ? (
          <div className="sr-pickup-slots">
            {[...new Set(dayPickups.map((p) => p.slot || "Walk-in"))].map((slot) => {
              const rows = dayPickups.filter((p) => (p.slot || "Walk-in") === slot);
              const { noShowAt, booked, capacity } = rows[0];
              return (
                <Card className="sr-slot" key={slot}>
                  <div className="sr-slot-heading">
                    <div>
                      <strong>{slot}</strong>
                      {capacity ? (
                        <span>
                          {" "}
                          · {booked} of {capacity} booked
                        </span>
                      ) : (
                        <span> · {rows.length} handed out</span>
                      )}
                    </div>
                    {rows.some((p) => p.noShowAllowed) ? (
                      <span className="sr-overdue">Slot ended · no-show allowed</span>
                    ) : (
                      noShowAt &&
                      rows.some((p) => p.status === "Approved") && (
                        <span>No-show allowed after {noShowAt}</span>
                      )
                    )}
                  </div>
                  {rows.map((pickup) => (
                    <div className="sr-slot-person" key={pickup.id}>
                      <div className="sr-slot-person-name person-cell">
                        <AccountAvatar profileId={pickup.recipientId} name={pickup.name} />
                        <div>
                          <strong>{pickup.name}</strong>
                          <div className="muted">
                            {pickup.studentId}
                            {pickup.firstVisit && pickup.status !== "Completed" && (
                              <span className="sr-first-visit"> · First visit: check ID card</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Status status={pickup.status} />
                      <div className="sr-pickup-actions">
                        {pickup.status === "Completed" ? (
                          <span className="muted">Picked up {pickup.pickedUp}</span>
                        ) : pickup.status === "No-show" ? (
                          <span className="muted">Did not attend</span>
                        ) : (
                          <>
                            <Button onClick={() => openDistribution(pickup)}>Hand out food</Button>
                            <Button
                              variant="secondary"
                              className="sr-no-show"
                              disabled={!pickup.noShowAllowed}
                              onClick={() => setNoShowPickup(pickup)}
                            >
                              Mark no-show
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              title="No pickups for this day"
              description="Choose another day to see scheduled pickups."
            />
            <div className="sr-return-today">
              <Button variant="secondary" onClick={() => setDayOffset(0)}>
                Back to today's pickups
              </Button>
            </div>
          </Card>
        )}
      </DataLoader>
    </>
  );
}
