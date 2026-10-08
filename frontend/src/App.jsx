import { useEffect, useState } from "react";

// Sprint 0 smoke test: proves the browser → /api → FastAPI path works.
// Replace with React Router + real screens in Sprint 1.
export default function App() {
  const [api, setApi] = useState("checking…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => setApi(d.status))
      .catch(() => setApi("unreachable"));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Panther Food Pantry</h1>
      <p>
        API status: <strong>{api}</strong>
      </p>
    </main>
  );
}
