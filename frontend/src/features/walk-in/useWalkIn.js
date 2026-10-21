import { useState, useRef, useEffect } from "react";
import { usePersistedState } from "../../hooks/usePersistedState.js";
import { initialStudents } from "../stock/data/students.js";
import { notifyError } from "../../components/Notifications.jsx";
import { waitForMockResponse as mockDelay } from "../../lib/mockLatency.js";

export function useWalkIn({ navigate, notify }) {
  const [studentId, setStudentId] = useState("");
  const [searchedId, setSearchedId] = useState("");
  const [fullName, setFullName] = useState("");
  const [idChecked, setIdChecked] = useState(false);
  const [match, setMatch] = useState(null);
  const [searchState, setSearchState] = useState("idle");
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = usePersistedState("panther-students-v1", initialStudents);
  const studentsRef = useRef(students);
  const operation = useRef(0);
  const busy = useRef(false);
  studentsRef.current = students;
  const hasResult = searchState === "found" || searchState === "not-found";

  // Ignore pending mock responses after navigating away.
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
      await mockDelay(650);
      if (token !== operation.current) return;
      const existing = studentsRef.current.find((student) => student.id.toUpperCase() === nextId);
      setSearchedId(nextId);
      setMatch(existing || null);
      setFullName(existing?.name || "");
      setSearchState(existing ? "found" : "not-found");
    } catch {
      if (token !== operation.current) return;
      setSearchState("idle");
      notifyError("The search could not be completed. Please try again.");
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
      await mockDelay(match ? 400 : 850);
      if (token !== operation.current) return;
      // Recheck after the simulated request to avoid duplicate profiles.
      const existing = studentsRef.current.find(
        (student) => student.id.toUpperCase() === searchedId,
      );
      const now = new Date();
      const checked = now.toLocaleDateString("en-US", {
        timeZone: "America/Chicago",
        month: "short",
        day: "numeric",
      });
      const student = existing || {
        name: fullName.trim(),
        id: searchedId,
        provisional: true,
        checked,
        lastPickup: "—",
        request: "",
      };
      const pickup = {
        id: `walk-in-${crypto.randomUUID()}`,
        name: student.name,
        studentId: searchedId,
        time: "Walk-in",
        date: now.toLocaleDateString("en-CA", { timeZone: "America/Chicago" }),
        fullPickupDate: now.toLocaleDateString("en-US", {
          timeZone: "America/Chicago",
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        note: "",
        firstVisit: !existing || student.lastPickup === "—",
        idChecked: true,
        status: "Approved",
      };
      localStorage.setItem("panther-active-pickup", JSON.stringify(pickup));
      setStudents((current) =>
        current.some((entry) => entry.id.toUpperCase() === searchedId)
          ? current.map((entry) =>
              entry.id.toUpperCase() === searchedId ? { ...entry, checked } : entry,
            )
          : [...current, student],
      );
      notify?.(
        existing
          ? "Student ready for a walk-in pickup."
          : "Provisional profile created. Add items to this pickup.",
      );
      navigate("/staff/distribution");
    } catch {
      if (token === operation.current)
        notifyError("Your browser could not save this pickup. Enable local storage and try again.");
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
