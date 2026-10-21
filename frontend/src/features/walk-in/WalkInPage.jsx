import { useWalkIn } from "./useWalkIn.js";
import { PageHeading } from "../../components/ui/PageHeading.jsx";
import { Field } from "../../components/ui/Field.jsx";
import { Button } from "../../components/ui/Button.jsx";

export function WalkIn({ navigate, notify }) {
  const {
    findStudent,
    searchState,
    studentId,
    resetSearch,
    saving,
    hasResult,
    match,
    searchedId,
    handOutFood,
    fullName,
    setFullName,
    idChecked,
    setIdChecked,
  } = useWalkIn({ navigate, notify });
  return (
    <div className="walk-in-page">
      <PageHeading title="Walk-in" description="For a student who arrives without a request." />
      <section className="walk-in-card" aria-labelledby="walk-in-find-title">
        <h2 id="walk-in-find-title">1. Find the student</h2>
        <form
          className="walk-in-search"
          onSubmit={findStudent}
          aria-busy={searchState === "searching"}
        >
          <Field label="Student ID number">
            <input
              className="input"
              aria-label="Student ID number to search"
              value={studentId}
              onChange={(event) => resetSearch(event.target.value)}
              placeholder="Enter student ID"
              autoComplete="off"
              maxLength={9}
              disabled={searchState === "searching" || saving}
              required
            />
          </Field>
          <Button type="submit" loading={searchState === "searching"} disabled={saving}>
            {searchState === "searching" ? "Searching…" : "Search"}
          </Button>
        </form>

        {searchState === "searching" && (
          <p className="walk-in-helper" role="status">
            Searching student records…
          </p>
        )}
        {hasResult && (
          <div className={`walk-in-status ${match ? "walk-in-status-found" : ""}`} role="status">
            <img src="/assets/figma/walk-in-info.svg" alt="" />
            <p>
              {match ? (
                <>
                  <strong>{match.name} found.</strong> Confirm their ID card below to start a
                  walk-in pickup.
                </>
              ) : (
                <>
                  <strong>No student found with ID {searchedId}.</strong> Create a provisional
                  profile below so the food handed out is still recorded.
                </>
              )}
            </p>
          </div>
        )}
      </section>

      {hasResult && (
        <>
          <form
            className="walk-in-card walk-in-profile"
            onSubmit={handOutFood}
            aria-labelledby="walk-in-profile-title"
            aria-busy={saving}
          >
            <h2 id="walk-in-profile-title">
              {match ? "2. Confirm the student" : "2. Create a provisional profile"}
            </h2>
            <div className="walk-in-profile-fields">
              <Field label="Full name">
                <input
                  className="input"
                  name="fullName"
                  value={fullName}
                  readOnly={!!match}
                  disabled={saving}
                  onChange={(event) => {
                    setFullName(event.target.value);
                  }}
                  required
                />
              </Field>
              <Field label="Student ID number">
                <input
                  className="input"
                  value={searchedId}
                  disabled
                  aria-label="Selected student ID number"
                />
              </Field>
            </div>
            <label className="walk-in-check">
              <input
                type="checkbox"
                checked={idChecked}
                disabled={saving}
                onChange={(event) => {
                  setIdChecked(event.target.checked);
                }}
              />
              <span>I checked the student's ID card</span>
            </label>
            <p className="walk-in-helper">
              {match
                ? "This pickup will be recorded on the student’s existing profile."
                : "If the student signs up later with this student ID, their pickups move to the new account."}
            </p>

            <Button type="submit" loading={saving}>
              {saving
                ? match
                  ? "Opening pickup…"
                  : "Creating profile…"
                : match
                  ? "Hand out food"
                  : "Create profile and hand out food"}
            </Button>
            {saving && (
              <p className="walk-in-helper" role="status">
                {match ? "Preparing the pickup…" : "Creating the student’s provisional profile…"}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
