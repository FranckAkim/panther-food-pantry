import { useState, useRef, useEffect } from "react";
import { notifyError } from "../../components/Notifications.jsx";
import { createProvisionalStudent, findStudent as lookUpStudent } from "../../api/operations.js";
import { affected } from "../../api/keys.js";
import { dayLabel, pantryToday } from "../../api/time.js";
import { useRefresh } from "../../lib/queryClient.js";
import { writeSession } from "../../hooks/useSessionState.js";
import { ACTIVE_PICKUP_KEY } from "../operations/hooks/useOperations.js";

export function useWalkIn({ navigate, notify }) {
  const refresh = useRefresh();
  const [studentId, setStudentId] = useState("");
  const [searchedId, setSearchedId] = useState("");
  const [fullName, setFullName] = useState("");
  const [idChecked, setIdChecked] = useState(false);
  const [match, setMatch] = useState(null);
  const [searchState, setSearchState] = useState("idle");
  const [saving, setSaving] = useState(false);
  const operation = useRef(0);
  const busy = useRef(false);
  const hasResult = searchState === "found" || searchState === "not-found";

  // Ignore responses that arrive after leaving the page or starting a new search.
  useEffect(
    () => () => {
      operation.current += 1;
    },
    [],
  );

  function resetSearch(value) {
    operation.current += 1;
    setStudentId(value);
    setSearchedId("");
    setSearchState("idle");
    setMatch(null);
    setFullName("");
    setIdChecked(false);
  }

  async function findStudent(event) {
    event.preventDefault();
    if (busy.current) return;
    const nextId = studentId.trim().toUpperCase();
    if (!/^P\d{8}$/.test(nextId)) {
      notifyError("Enter a student ID beginning with P followed by eight numbers.");
      return;
    }
    const token = ++operation.current;
    busy.current = true;
    setStudentId(nextId);
    setSearchState("searching");
    setMatch(null);
    setFullName("");
    setIdChecked(false);
    try {
      const existing = await lookUpStudent(nextId);
      if (token !== operation.current) return;
      setSearchedId(nextId);
      setMatch(existing);
      setFullName(existing?.name || "");
      setSearchState(existing ? "found" : "not-found");
    } catch (error) {
      if (token !== operation.current) return;
      setSearchState("idle");
      notifyError(error.message || "The search could not be completed. Please try again.");
    } finally {
      if (token === operation.current) busy.current = false;
    }
  }

  async function handOutFood(event) {
    event.preventDefault();
    if (busy.current) return;
    if (!hasResult || studentId.trim().toUpperCase() !== searchedId) {
      notifyError("Search for this student ID before continuing.");
      return;
    }
    if (!fullName.trim()) {
      notifyError("Enter the student’s full name.");
      return;
    }
    if (!idChecked) {
      notifyError("Check the student’s ID card before continuing.");
      return;
    }
    const token = ++operation.current;
    busy.current = true;
    setSaving(true);
    try {
      const student =
        match ||
        (await createProvisionalStudent({
          studentId: searchedId,
          name: fullName.trim(),
          idChecked: true,
        }).then((created) => ({
          kind: "provisional",
          id: created.id,
          name: created.full_name,
          studentId: created.student_id,
          firstVisit: true,
        })));
      if (token !== operation.current) return;
      const today = pantryToday();
      writeSession(ACTIVE_PICKUP_KEY, {
        id: `walk-in-${student.id}`,
        requestId: null,
        kind: student.kind,
        recipientId: student.id,
        name: student.name,
        studentId: student.studentId,
        time: "Walk-in",
        slot: null,
        date: today,
        fullPickupDate: dayLabel(today),
        note: "",
        firstVisit: student.firstVisit,
        idChecked: true,
      });
      if (!match) await refresh(affected.students);
      notify?.(
        match
          ? "Student ready for a walk-in pickup."
          : "Provisional profile created. Add items to this pickup.",
      );
      navigate("/staff/distribution");
    } catch (error) {
      if (token === operation.current) notifyError(error.message);
    } finally {
      if (token === operation.current) {
        busy.current = false;
        setSaving(false);
      }
    }
  }

  return {
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
  };
}
