import { useOperations } from "./hooks/useOperations.js";
import { Button } from "../../components/ui/Button.jsx";
import { Asset } from "./components/Asset.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { RequestsPage } from "./pages/RequestsPage.jsx";
import { RequestDetailsPage } from "./pages/RequestDetailsPage.jsx";
import { PickupsPage } from "./pages/PickupsPage.jsx";
import { DistributionPage } from "./pages/DistributionPage.jsx";
import { DeclineRequestDialog } from "./components/DeclineRequestDialog.jsx";
import { NoShowDialog } from "./components/NoShowDialog.jsx";
import { DataLoader } from "../../components/loading/DataLoader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";

export function StaffRequests({ page, navigate, notify }) {
  const {
    queries,
    today,
    pickupDate,
    waitingCount,
    dashboardPickups,
    lowStockItems,
    expiringLots,
    openDistribution,
    search,
    setSearch,
    approvedCount,
    filter,
    setFilter,
    filteredRequests,
    setSelectedRequest,
    approve,
    openDecline,
    activeRequest,
    dayOffset,
    dayPickups,
    doneCount,
    pendingCount,
    setDayOffset,
    setNoShowPickup,
    selectedPickup,
    pending,
    idChecked,
    setIdChecked,
    addItem,
    itemId,
    setItemId,
    availableCatalog,
    quantity,
    setQuantity,
    displayedItems,
    setItems,
    setItemQty,
    items,
    units,
    requestedFood,
    completePickup,
    declining,
    setDeclining,
    decline,
    reason,
    setReason,
    noShowPickup,
    confirmNoShow,
  } = useOperations({ page, navigate, notify });
  const textLink = (text, destination) => (
    <button className="sr-text-link" onClick={() => navigate(destination)}>
      {text}
    </button>
  );
  const walkInButton = (
    <Button variant="secondary" onClick={() => navigate("/staff/walk-in")}>
      <Asset name="walk-in" />
      Walk-in
    </Button>
  );

  return (
    <div className="staff-requests">
      {page === "dashboard" && (
        <DataLoader
          queries={[queries.requests, queries.pickups, queries.inventory]}
          label="Loading dashboard…"
        >
          <DashboardPage
            today={today}
            walkInButton={walkInButton}
            navigate={navigate}
            waitingCount={waitingCount}
            textLink={textLink}
            dashboardPickups={dashboardPickups}
            lowStockItems={lowStockItems}
            expiringLots={expiringLots}
            openDistribution={openDistribution}
          />
        </DataLoader>
      )}

      {page === "requests" && (
        <RequestsPage
          search={search}
          setSearch={setSearch}
          waitingCount={waitingCount}
          approvedCount={approvedCount}
          filter={filter}
          setFilter={setFilter}
          filteredRequests={filteredRequests}
          setSelectedRequest={setSelectedRequest}
          navigate={navigate}
          approve={approve}
          openDecline={openDecline}
          requestsQuery={queries.requests}
        />
      )}

      {page === "request-detail" && (
        <DataLoader queries={queries.requests} label="Loading request…">
          {activeRequest ? (
            <RequestDetailsPage
              textLink={textLink}
              activeRequest={activeRequest}
              openDecline={openDecline}
              approve={approve}
            />
          ) : (
            <Card>
              <EmptyState
                title="Request not found"
                description="It may be older than 60 days. Choose a request from the list."
              />
              {textLink("Back to requests", "/staff/requests")}
            </Card>
          )}
        </DataLoader>
      )}

      {page === "pickups" && (
        <PickupsPage
          pickupDate={pickupDate}
          pickupsQuery={queries.pickups}
          dayOffset={dayOffset}
          dayPickups={dayPickups}
          doneCount={doneCount}
          pendingCount={pendingCount}
          setDayOffset={setDayOffset}
          walkInButton={walkInButton}
          openDistribution={openDistribution}
          setNoShowPickup={setNoShowPickup}
        />
      )}

      {page === "distribution" && !selectedPickup && (
        <Card>
          <EmptyState
            title="No pickup selected"
            description="Choose a student from today's pickups or record a walk-in."
          />
          {textLink("Go to today's pickups", "/staff/pickups")}
        </Card>
      )}

      {page === "distribution" && selectedPickup && (
        <DataLoader queries={queries.inventory} label="Loading stock…">
          <DistributionPage
            textLink={textLink}
            selectedPickup={selectedPickup}
            pending={pending}
            idChecked={idChecked}
            setIdChecked={setIdChecked}
            addItem={addItem}
            itemId={itemId}
            setItemId={setItemId}
            availableCatalog={availableCatalog}
            quantity={quantity}
            setQuantity={setQuantity}
            displayedItems={displayedItems}
            setItems={setItems}
            setItemQty={setItemQty}
            items={items}
            units={units}
            requestedFood={requestedFood}
            navigate={navigate}
            completePickup={completePickup}
          />
        </DataLoader>
      )}

      {declining && (
        <DeclineRequestDialog
          setDeclining={setDeclining}
          decline={decline}
          declining={declining}
          reason={reason}
          setReason={setReason}
        />
      )}
      {noShowPickup && (
        <NoShowDialog
          setNoShowPickup={setNoShowPickup}
          noShowPickup={noShowPickup}
          confirmNoShow={confirmNoShow}
        />
      )}
    </div>
  );
}
