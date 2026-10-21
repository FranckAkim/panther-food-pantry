import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Asset } from "../components/Asset.jsx";
import { DataLoader } from "../../../components/loading/DataLoader.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { Status } from "../components/Status.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";

export function PickupsPage({
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
        description={`${new Date(Date.UTC(2026, 9, 14 + dayOffset, 12)).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}${dayPickups.length ? ` · ${doneCount} done · ${pendingCount} to go` : ""}`}
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
      <DataLoader queryKey={dayOffset} initialLoading={false} label="Loading pickups…">
        {dayPickups.length ? (
          <div className="sr-pickup-slots">
            {[...new Set(dayPickups.map((p) => p.slot || "Walk-in"))].map((slot) => {
              const rows = dayPickups.filter((p) => (p.slot || "Walk-in") === slot);
              const noShowAt = slot.startsWith("1:30")
                ? "2:30 PM"
                : slot.startsWith("1:00")
                  ? "2:00 PM"
                  : null;
              return (
                <Card className="sr-slot" key={slot}>
                  <div className="sr-slot-heading">
                    <div>
                      <strong>{slot}</strong>
                      <span> · {rows.length} of 5 booked</span>
                    </div>
                    {rows.some((p) => p.noShowAllowed && p.status === "Approved") ? (
                      <span className="sr-overdue">Slot ended · no-show allowed</span>
                    ) : (
                      noShowAt && <span>No-show allowed after {noShowAt}</span>
                    )}
                  </div>
                  {rows.map((pickup) => (
                    <div className="sr-slot-person" key={pickup.id}>
                      <div className="sr-slot-person-name">
                        <strong>{pickup.name}</strong>
                        <div className="muted">
                          {pickup.studentId}
                          {pickup.firstVisit && pickup.status !== "Completed" && (
                            <span className="sr-first-visit"> · First visit: check ID card</span>
                          )}
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
