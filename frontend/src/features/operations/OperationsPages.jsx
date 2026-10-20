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

export function StaffRequests({ page, navigate, notify }) {
  const {
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
    items,
    completePickup,
    declining,
    setDeclining,
    decline,
    reason,
    setReason,
    noShowPickup,
    setPickups,
    setRequests,
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
        <DashboardPage
          walkInButton={walkInButton}
          navigate={navigate}
          waitingCount={waitingCount}
          textLink={textLink}
          dashboardPickups={dashboardPickups}
          lowStockItems={lowStockItems}
          expiringLots={expiringLots}
          openDistribution={openDistribution}
        />
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
        />
      )}

      {page === "request-detail" && activeRequest && (
        <RequestDetailsPage
          textLink={textLink}
          activeRequest={activeRequest}
          openDecline={openDecline}
          approve={approve}
        />
      )}

      {page === "pickups" && (
        <PickupsPage
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

      {page === "distribution" && (
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
          items={items}
          navigate={navigate}
          completePickup={completePickup}
        />
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
          setPickups={setPickups}
          noShowPickup={noShowPickup}
          setRequests={setRequests}
          notify={notify}
        />
      )}
    </div>
  );
}
