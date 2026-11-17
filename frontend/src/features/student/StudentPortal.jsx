import { useStudentPortal } from "./hooks/useStudentPortal.js";
import { RequestStatusCard } from "./components/RequestStatusCard.jsx";
import { StudentHeader } from "./components/StudentHeader.jsx";
import { DataLoader } from "../../components/loading/DataLoader.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { RequestFoodPage } from "./pages/RequestFoodPage.jsx";
import { RequestStatusPage } from "./pages/RequestStatusPage.jsx";
import { HistoryPage } from "./pages/HistoryPage.jsx";
import { CancelRequestDialog } from "./components/CancelRequestDialog.jsx";
import { RequestSubmittedDialog } from "./components/RequestSubmittedDialog.jsx";

export function Student({ page, navigate, notify, profile, signOut }) {
  const {
    queries,
    open,
    setCancelRequest,
    accountOpen,
    setAccountOpen,
    availability,
    submit,
    foodId,
    chooseFood,
    foods,
    food,
    days,
    day,
    setDay,
    setSlotId,
    daySlots,
    slotId,
    note,
    setNote,
    selectedSlot,
    past,
    cancelRequest,
    cancel,
    submitted,
    setSubmitted,
  } = useStudentPortal({ page, navigate, notify, profile });
  const pageQueries = {
    home: [queries.requests, queries.availability],
    request: [queries.requests, queries.foods],
  }[page] || [queries.requests];
  const requestCard = open && <RequestStatusCard open={open} setCancelRequest={setCancelRequest} />;

  return (
    <div className="student-app">
      <StudentHeader
        page={page}
        accountOpen={accountOpen}
        setAccountOpen={setAccountOpen}
        profile={profile}
        signOut={signOut}
        notify={notify}
      />
      <main className="student-main" id="main-content" tabIndex={-1}>
        <DataLoader queries={pageQueries} label="Loading your pantry…">
          {page === "home" && (
            <HomePage
              profile={profile}
              open={open}
              navigate={navigate}
              requestCard={requestCard}
              availability={availability}
            />
          )}
          {page === "request" && (
            <RequestFoodPage
              open={open}
              requestCard={requestCard}
              submit={submit}
              foodId={foodId}
              chooseFood={chooseFood}
              foods={foods}
              food={food}
              days={days}
              day={day}
              setDay={setDay}
              setSlotId={setSlotId}
              daySlots={daySlots}
              slotId={slotId}
              note={note}
              setNote={setNote}
              selectedSlot={selectedSlot}
              slotsQuery={queries.slots}
            />
          )}
          {page === "request-status" && (
            <RequestStatusPage requestCard={requestCard} navigate={navigate} />
          )}
          {page === "history" && <HistoryPage open={open} navigate={navigate} past={past} />}
        </DataLoader>
      </main>
      {cancelRequest && (
        <CancelRequestDialog
          setCancelRequest={setCancelRequest}
          cancel={cancel}
          cancelRequest={cancelRequest}
        />
      )}
      {submitted && <RequestSubmittedDialog setSubmitted={setSubmitted} submitted={submitted} />}
    </div>
  );
}
