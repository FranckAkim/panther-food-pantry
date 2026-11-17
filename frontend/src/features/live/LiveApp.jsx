import { cloneElement, useCallback, useEffect, useId, useRef, useState } from "react";
import { getPantryApi } from "../../lib/supabase.js";
import { emptyData, loadWorkspace, openRequest, quantity, report, today } from "./model.js";
import "./live.css";

const time = (value) =>
  value ? new Date(value).toLocaleString("en-US", { timeZone: "America/Chicago" }) : "—";
const nameOf = (data, id) => data.profiles.find((p) => p.id === id)?.display_name || id;
function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="live-field">
      <label htmlFor={id}>{label}</label>
      {children ? cloneElement(children, { id }) : <input id={id} {...props} />}
    </div>
  );
}
function Table({ headings, children }) {
  return (
    <div className="live-table">
      <table>
        <thead>
          <tr>
            {headings.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Form({ action, children, submit = "Save", busy }) {
  return (
    <form
      className="live-form"
      onSubmit={(event) => {
        event.preventDefault();
        action(new FormData(event.currentTarget), event.currentTarget);
      }}
    >
      <fieldset disabled={busy}>
        {children}
        <button type="submit">{busy ? "Working…" : submit}</button>
      </fieldset>
    </form>
  );
}
function Lines({ data, lines, setLines, donation = false }) {
  const patch = (id, field, value) =>
    setLines((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  return (
    <div className="stack">
      {lines.map((line, index) => (
        <div className="live-line" key={line.id}>
          <Field label={`Item ${index + 1}`}>
            <select
              required
              value={line.item_id}
              onChange={(e) => patch(line.id, "item_id", e.target.value)}
            >
              <option value="">Select item</option>
              {data.items
                .filter((i) => i.active)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label={`Quantity ${index + 1}`}
            type="number"
            min="1"
            max="2147483647"
            step="1"
            required
            value={line.quantity}
            onChange={(e) => patch(line.id, "quantity", Number(e.target.value))}
          />
          {donation && (
            <>
              <Field
                label={`Storage ${index + 1}`}
                required
                maxLength={100}
                value={line.storage_location}
                onChange={(e) => patch(line.id, "storage_location", e.target.value)}
              />
              <Field
                label={`Expiry ${index + 1}`}
                type="date"
                value={line.expiry_date}
                onChange={(e) => patch(line.id, "expiry_date", e.target.value)}
              />
            </>
          )}
          <button
            type="button"
            className="live-secondary"
            onClick={() => setLines((rows) => rows.filter((r) => r.id !== line.id))}
          >
            Remove item {index + 1}
          </button>
        </div>
      ))}
      <button
        type="button"
        className="live-secondary"
        onClick={() =>
          setLines((rows) => [
            ...rows,
            {
              id: crypto.randomUUID(),
              item_id: "",
              quantity: 1,
              storage_location: "",
              expiry_date: "",
            },
          ])
        }
      >
        Add line
      </button>
    </div>
  );
}

export function LiveApp({ api: providedApi }) {
  const [api] = useState(() => {
    try {
      return providedApi || getPantryApi();
    } catch {
      return null;
    }
  });
  const [account, setAccount] = useState(null);
  const [checking, setChecking] = useState(true);
  const [data, setData] = useState(emptyData);
  const [page, setPage] = useState("Requests");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(() =>
    ["recovery", "invite"].includes(new URLSearchParams(window.location.hash.slice(1)).get("type")),
  );
  const [authMode, setAuthMode] = useState("Sign in");
  const [workspace, setWorkspace] = useState("student");
  const [selected, setSelected] = useState(null);
  const [lines, setLines] = useState([]);
  const [invitation, setInvitation] = useState("");
  const [start, setStart] = useState(today().slice(0, 7) + "-01");
  const [end, setEnd] = useState(today());
  const actionLock = useRef(false);
  const generation = useRef(0);
  const requestId = useRef(crypto.randomUUID());
  const donationId = useRef(crypto.randomUUID());
  const walkInId = useRef(crypto.randomUUID());
  const refresh = useCallback(async () => {
    const revision = ++generation.current;
    const current = await api.currentUser();
    if (revision !== generation.current) return;
    if (!current) {
      setAccount(null);
      setData(emptyData());
      return;
    }
    const next = await loadWorkspace(api, current.role);
    if (revision !== generation.current) return;
    setAccount(current);
    setData(next);
  }, [api]);
  useEffect(() => {
    if (!api) {
      setChecking(false);
      return;
    }
    let active = true;
    const check = () =>
      refresh()
        .catch((problem) => {
          if (active) {
            setAccount(null);
            setData(emptyData());
            setError(problem.message);
          }
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    // Schedule outside the Auth callback to avoid awaiting Auth while its lock is held.
    let timer;
    const unsubscribe = api.onAuthChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        generation.current++;
        setAccount(null);
        setData(emptyData());
        setInvitation("");
      } else {
        clearTimeout(timer);
        timer = setTimeout(check, 0);
      }
    });
    check();
    const interval = setInterval(check, 30000);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      generation.current++;
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener("focus", check);
    };
  }, [api, refresh]);
  async function act(work, success = "Saved.") {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
      if (success) setNotice(success);
    } catch (problem) {
      setError(problem.message || "Operation failed. Check your connection and retry.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  const save = async (work) => {
    await work();
    await refresh();
  };
  const signOut = () =>
    act(async () => {
      await api.signOut();
      setAccount(null);
      setData(emptyData());
      setInvitation("");
      setSelected(null);
      setLines([]);
    }, "Signed out.");
  const openPickup = (request) => {
    setSelected(request);
    setLines([]);
    setPage("Complete pickup");
  };
  const roles = account?.role;
  const stats = report(data, start, end);
  const tabs =
    roles === "student"
      ? ["Requests", "Account"]
      : [
          "Requests",
          "Inventory",
          "Donations",
          "Pickup slots",
          "Students",
          ...(roles === "admin" ? ["Users", "Reports", "Audit"] : []),
          "Account",
        ];
  const messages = (
    <>
      {error && (
        <div role="alert" className="live-error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="live-notice">
          {notice}
        </div>
      )}
    </>
  );
  if (!api)
    return (
      <main className="live-app">
        <h1>Connect Panther Pantry</h1>
        <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the frontend.</p>
        <p>Use VITE_PANTRY_MODE=demo only for the separate sample walkthrough.</p>
      </main>
    );
  if (checking)
    return (
      <main className="live-app" role="status">
        Connecting to Panther Pantry…
      </main>
    );
  if (!account)
    return (
      <main className="live-app live-auth">
        <h1>Panther Pantry</h1>
        <p>Prairie View A&amp;M University</p>
        {messages}
        <h2>{authMode}</h2>
        <Form
          busy={busy}
          submit={authMode}
          action={(f) =>
            act(async () => {
              if (authMode === "Register") {
                const result = await api.registerStudent({
                  email: f.get("email"),
                  password: f.get("password"),
                  displayName: f.get("name"),
                });
                if (!result.session) {
                  setNotice("Check your university email to confirm your account, then sign in.");
                  setAuthMode("Sign in");
                  return;
                }
              } else if (authMode === "Reset password") {
                await api.requestPasswordReset(f.get("email"), window.location.origin);
                setNotice("Check your email for the password reset link.");
                return;
              } else
                await api.signIn({ email: f.get("email"), password: f.get("password"), workspace });
              await refresh();
              setPage("Requests");
            }, "")
          }
        >
          {authMode === "Sign in" && (
            <Field label="Workspace">
              <select value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          )}
          {authMode === "Register" && (
            <Field label="Full name" name="name" required maxLength={100} autoComplete="name" />
          )}
          <Field
            label="University email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          {authMode !== "Reset password" && (
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={authMode === "Register" ? "new-password" : "current-password"}
              minLength={authMode === "Register" ? 8 : 1}
              required
            />
          )}
        </Form>
        <div className="live-actions">
          {["Sign in", "Register", "Reset password"]
            .filter((m) => m !== authMode)
            .map((m) => (
              <button
                className="live-secondary"
                key={m}
                onClick={() => {
                  setAuthMode(m);
                  setError("");
                }}
              >
                {m}
              </button>
            ))}
        </div>
        <p>Use a separate pantry password. Bring your student ID for staff verification.</p>
      </main>
    );
  return (
    <div className="live-app">
      <a className="skip-link" href="#live-main">
        Skip to content
      </a>
      <header className="live-header">
        <div>
          <strong>Panther Pantry</strong>
          <p>
            {account.profile.display_name || account.user.email} · {roles}
          </p>
        </div>
        <div className="live-actions">
          <button
            className="live-secondary"
            disabled={busy}
            onClick={() => act(refresh, "Updated.")}
          >
            Refresh
          </button>
          <button disabled={busy} onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <nav aria-label="Pantry pages" className="live-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            aria-current={page === tab ? "page" : undefined}
            onClick={() => {
              setPage(tab);
              setSelected(null);
              setLines([]);
              setInvitation("");
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
      <main id="live-main" tabIndex={-1}>
        <h1>{recovery ? "Set your password" : page}</h1>
        {messages}
        {recovery ? (
          <Form
            busy={busy}
            submit="Set password"
            action={(f) =>
              act(async () => {
                await api.updatePassword(f.get("password"));
                setRecovery(false);
              }, "Password updated.")
            }
          >
            <Field
              label="New password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </Form>
        ) : (
          <>
            {page === "Requests" && (
              <>
                {roles !== "student" && (
                  <section>
                    <h2>Walk-in pickup</h2>
                    <Form
                      busy={busy}
                      submit="Start walk-in"
                      action={(f) =>
                        act(async () => {
                          const request = await api.createWalkIn({
                            id: walkInId.current,
                            studentId: f.get("student"),
                            categories: f.getAll("categories"),
                          });
                          walkInId.current = crypto.randomUUID();
                          await refresh();
                          openPickup(request);
                        }, "Walk-in started. Verify ID and choose items to finish.")
                      }
                    >
                      <Field label="Registered student">
                        <select name="student" required>
                          <option value="">Choose student</option>
                          {data.students.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.display_name} · {p.student_id || "ID not verified"}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <fieldset>
                        <legend>Food categories</legend>
                        {[...new Set(data.available.map((i) => i.category))].map((c) => (
                          <label className="live-check" key={c}>
                            <input name="categories" type="checkbox" value={c} />
                            {c}
                          </label>
                        ))}
                      </fieldset>
                    </Form>
                  </section>
                )}
                {roles === "student" && !data.requests.some(openRequest) && (
                  <section>
                    <h2>Request food</h2>
                    <Form
                      busy={busy}
                      submit="Reserve pickup"
                      action={(f) =>
                        act(
                          () =>
                            save(async () => {
                              await api.reserveRequest({
                                id: requestId.current,
                                categories: f.getAll("categories"),
                                slotId: f.get("slot"),
                                note: f.get("note"),
                              });
                              requestId.current = crypto.randomUUID();
                            }),
                          "Request submitted.",
                        )
                      }
                    >
                      <fieldset>
                        <legend>Available food categories</legend>
                        {[...new Set(data.available.map((i) => i.category))].map((c) => (
                          <label className="live-check" key={c}>
                            <input type="checkbox" name="categories" value={c} />
                            {c}
                          </label>
                        ))}
                        {!data.available.length && <p>No food is currently available.</p>}
                      </fieldset>
                      <Field label="Pickup slot">
                        <select name="slot" required>
                          <option value="">Choose a time (Central)</option>
                          {data.slots
                            .filter((s) => s.active && new Date(s.starts_at) > new Date())
                            .map((s) => (
                              <option disabled={s.booked >= s.capacity} key={s.id} value={s.id}>
                                {time(s.starts_at)} · {s.capacity - s.booked} available
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Pickup note" name="note" maxLength={500} />
                    </Form>
                  </section>
                )}
                <Table
                  headings={[
                    roles === "student" ? "Request" : "Student",
                    "Categories",
                    "Pickup (Central)",
                    "Status",
                    "Note",
                    "Actions",
                  ]}
                >
                  {[...data.requests]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          {roles === "student" ? r.id.slice(0, 8) : nameOf(data, r.student_id)}
                        </td>
                        <td>{r.requested_categories.join(", ")}</td>
                        <td>{time(data.slots.find((s) => s.id === r.slot_id)?.starts_at)}</td>
                        <td>{r.status}</td>
                        <td>{r.decision_note || r.pickup_note}</td>
                        <td className="live-actions">
                          {roles === "student" && openRequest(r) && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                act(
                                  () =>
                                    save(() =>
                                      api.transitionRequest({ id: r.id, status: "cancelled" }),
                                    ),
                                  "Request cancelled.",
                                )
                              }
                            >
                              Cancel request
                            </button>
                          )}
                          {roles !== "student" && r.status === "submitted" && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                act(
                                  () =>
                                    save(() =>
                                      api.transitionRequest({ id: r.id, status: "approved" }),
                                    ),
                                  "Request approved.",
                                )
                              }
                            >
                              Approve
                            </button>
                          )}
                          {roles !== "student" && openRequest(r) && (
                            <button
                              disabled={busy}
                              className="live-secondary"
                              onClick={() => {
                                setSelected(r);
                                setPage("Decline request");
                              }}
                            >
                              Decline
                            </button>
                          )}
                          {roles !== "student" && r.status === "approved" && (
                            <button disabled={busy} onClick={() => openPickup(r)}>
                              Complete pickup
                            </button>
                          )}
                          {roles !== "student" && r.status === "approved" && (
                            <button
                              disabled={busy}
                              className="live-secondary"
                              onClick={() =>
                                act(
                                  () =>
                                    save(() =>
                                      api.transitionRequest({
                                        id: r.id,
                                        status: "declined",
                                        note: "No-show",
                                      }),
                                    ),
                                  "No-show recorded; slot released.",
                                )
                              }
                            >
                              No-show
                            </button>
                          )}
                          {r.status === "completed" && (
                            <span>
                              {data.pickupLines
                                .filter((l) => l.request_id === r.id)
                                .reduce((n, l) => n + l.quantity, 0)}{" "}
                              units · {time(r.completed_at)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </Table>
                {!data.requests.length && <p>No requests yet.</p>}
              </>
            )}
            {page === "Decline request" && selected && (
              <Form
                busy={busy}
                submit="Decline request"
                action={(f) =>
                  act(async () => {
                    await save(() =>
                      api.transitionRequest({
                        id: selected.id,
                        status: "declined",
                        note: f.get("reason"),
                      }),
                    );
                    setPage("Requests");
                  }, "Request declined.")
                }
              >
                <Field label="Reason for student" name="reason" required maxLength={500} />
              </Form>
            )}
            {page === "Complete pickup" && selected && (
              <Form
                busy={busy}
                submit="Complete pickup"
                action={(f) =>
                  act(async () => {
                    await save(() =>
                      api.completePickup({
                        requestId: selected.id,
                        lines: lines.map(({ item_id, quantity }) => ({ item_id, quantity })),
                        idChecked: f.get("checked") === "on",
                      }),
                    );
                    setPage("Requests");
                    setLines([]);
                  }, "Pickup completed. Stock and history updated.")
                }
              >
                <p>
                  {nameOf(data, selected.student_id)} ·{" "}
                  {data.profiles.find((p) => p.id === selected.student_id)?.student_id ||
                    "Student ID must be verified on Students page first."}
                </p>
                <label className="live-check">
                  <input type="checkbox" name="checked" required />I checked the student's physical
                  ID
                </label>
                <Lines data={data} lines={lines} setLines={setLines} />
              </Form>
            )}
            {page === "Inventory" && (
              <>
                <section>
                  <h2>Add inventory item</h2>
                  <Form
                    busy={busy}
                    submit="Add item"
                    action={(f, form) =>
                      act(
                        () =>
                          save(async () => {
                            await api.createItem({
                              name: f.get("name"),
                              category: f.get("category"),
                              unit: f.get("unit"),
                            });
                            form.reset();
                          }),
                        "Item created. Receive a donation to add stock.",
                      )
                    }
                  >
                    <Field label="Item name" name="name" required maxLength={120} />
                    <Field label="Category" name="category" required maxLength={80} />
                    <Field label="Unit" name="unit" defaultValue="each" required maxLength={30} />
                  </Form>
                </section>
                <Table
                  headings={["Item", "Category", "Eligible / total units", "Active", "Actions"]}
                >
                  {data.items.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>{i.category}</td>
                      <td>
                        {quantity(i.id, data.lots)} /{" "}
                        {data.lots
                          .filter((l) => l.item_id === i.id)
                          .reduce((s, l) => s + l.qty_on_hand, 0)}
                      </td>
                      <td>{i.active ? "Yes" : "No"}</td>
                      <td>
                        <button
                          className="live-secondary"
                          onClick={() => {
                            setSelected(i);
                            setPage("Item details");
                          }}
                        >
                          View / edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
            {page === "Item details" && selected && (
              <>
                <Form
                  busy={busy}
                  action={(f) =>
                    act(() =>
                      save(() =>
                        api.updateItem(selected.id, {
                          name: f.get("name"),
                          category: f.get("category"),
                          unit: f.get("unit"),
                          active: f.get("active") === "on",
                        }),
                      ),
                    )
                  }
                >
                  <Field
                    label="Item name"
                    name="name"
                    defaultValue={selected.name}
                    required
                    maxLength={120}
                  />
                  <Field
                    label="Category"
                    name="category"
                    defaultValue={selected.category}
                    required
                    maxLength={80}
                  />
                  <Field
                    label="Unit"
                    name="unit"
                    defaultValue={selected.unit}
                    required
                    maxLength={30}
                  />
                  <label className="live-check">
                    <input type="checkbox" name="active" defaultChecked={selected.active} />
                    Active
                  </label>
                </Form>
                <h2>Lots</h2>
                <Table headings={["Lot", "Quantity", "Received", "Expiry", "Storage"]}>
                  {data.lots
                    .filter((l) => l.item_id === selected.id)
                    .map((l) => (
                      <tr key={l.id}>
                        <td>{l.id.slice(0, 8)}</td>
                        <td>{l.qty_on_hand}</td>
                        <td>{l.received_date}</td>
                        <td>{l.expiry_date || "—"}</td>
                        <td>{l.storage_location}</td>
                      </tr>
                    ))}
                </Table>
                <h2>Adjust stock</h2>
                {data.lots
                  .filter((l) => l.item_id === selected.id)
                  .map((l) => (
                    <details key={l.id}>
                      <summary>Edit lot {l.id.slice(0, 8)}</summary>
                      <Form
                        busy={busy}
                        submit="Save lot details"
                        action={(f) =>
                          act(() =>
                            save(() =>
                              api.updateLot(l.id, {
                                storageLocation: f.get("storage"),
                                receivedDate: f.get("received"),
                                expiryDate: f.get("expiry") || null,
                              }),
                            ),
                          )
                        }
                      >
                        <Field
                          label="Storage location"
                          name="storage"
                          defaultValue={l.storage_location}
                          required
                          maxLength={100}
                        />
                        <Field
                          label="Received date"
                          name="received"
                          type="date"
                          defaultValue={l.received_date}
                          required
                        />
                        <Field
                          label="Expiry date"
                          name="expiry"
                          type="date"
                          defaultValue={l.expiry_date || ""}
                        />
                      </Form>
                    </details>
                  ))}
                <Form
                  busy={busy}
                  submit="Adjust stock"
                  action={(f) =>
                    act(
                      () =>
                        save(() =>
                          api.adjustStock({
                            lotId: f.get("lot"),
                            delta: Number(f.get("delta")),
                            reason: f.get("reason"),
                          }),
                        ),
                      "Stock adjusted.",
                    )
                  }
                >
                  <Field label="Lot">
                    <select name="lot" required>
                      {data.lots
                        .filter((l) => l.item_id === selected.id)
                        .map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.id.slice(0, 8)} · {l.storage_location} · {l.qty_on_hand}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field
                    label="Change (+ or − units)"
                    name="delta"
                    type="number"
                    step="1"
                    required
                  />
                  <Field label="Reason" name="reason" required maxLength={500} />
                </Form>
                <h2>Stock history</h2>
                <Table headings={["Time", "Change", "After", "Reason"]}>
                  {data.stock
                    .filter((a) =>
                      data.lots.some((l) => l.id === a.lot_id && l.item_id === selected.id),
                    )
                    .sort((a, b) => b.id - a.id)
                    .map((a) => (
                      <tr key={a.id}>
                        <td>{time(a.created_at)}</td>
                        <td>{a.quantity_change}</td>
                        <td>{a.quantity_after}</td>
                        <td>{a.reason}</td>
                      </tr>
                    ))}
                </Table>
              </>
            )}
            {page === "Donations" && (
              <>
                <Form
                  busy={busy}
                  submit="Receive donation"
                  action={(f, form) =>
                    act(
                      () =>
                        save(async () => {
                          await api.receiveDonation({
                            id: donationId.current,
                            donor: f.get("donor"),
                            receivedDate: f.get("received"),
                            lines: lines.map(
                              ({ item_id, quantity, storage_location, expiry_date }) => ({
                                item_id,
                                quantity,
                                storage_location,
                                expiry_date,
                              }),
                            ),
                          });
                          donationId.current = crypto.randomUUID();
                          setLines([]);
                          form.reset();
                        }),
                      "Donation received. All stock was saved together.",
                    )
                  }
                >
                  <Field label="Donor" name="donor" required maxLength={200} />
                  <Field
                    label="Received date"
                    name="received"
                    type="date"
                    defaultValue={today()}
                    max={today()}
                    required
                  />
                  <Lines data={data} lines={lines} setLines={setLines} donation />
                </Form>
                <Table headings={["Donor", "Received", "Units"]}>
                  {data.donations.map((d) => (
                    <tr key={d.id}>
                      <td>{d.donor}</td>
                      <td>{d.received_date}</td>
                      <td>
                        {data.donationLines
                          .filter((l) => l.donation_id === d.id)
                          .reduce((s, l) => s + l.quantity, 0)}
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
            {page === "Pickup slots" && (
              <>
                <Form
                  busy={busy}
                  submit="Create pickup slot"
                  action={(f, form) =>
                    act(() =>
                      save(async () => {
                        await api.savePickupSlot({
                          startsAt: new Date(f.get("starts")).toISOString(),
                          capacity: Number(f.get("capacity")),
                        });
                        form.reset();
                      }),
                    )
                  }
                >
                  <Field
                    label="Pickup time (your device timezone)"
                    name="starts"
                    type="datetime-local"
                    required
                  />
                  <Field
                    label="Capacity"
                    name="capacity"
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    required
                  />
                </Form>
                <Table headings={["Time (Central)", "Booked / capacity", "Active", "Actions"]}>
                  {data.slots.map((s) => (
                    <tr key={s.id}>
                      <td>{time(s.starts_at)}</td>
                      <td>
                        {s.booked} / {s.capacity}
                      </td>
                      <td>{s.active ? "Yes" : "No"}</td>
                      <td>
                        {new Date(s.starts_at) > new Date() && (
                          <button
                            disabled={busy}
                            className="live-secondary"
                            onClick={() =>
                              act(() =>
                                save(() =>
                                  api.savePickupSlot({
                                    id: s.id,
                                    startsAt: s.starts_at,
                                    capacity: s.capacity,
                                    active: !s.active,
                                  }),
                                ),
                              )
                            }
                          >
                            {s.active ? "Close slot" : "Reopen slot"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
            {page === "Students" && (
              <>
                <p>
                  Save an ID only after checking the physical card. Students register with their
                  university email; staff cannot set a student's password.
                </p>
                {data.students.map((p) => (
                  <section key={p.id}>
                    <h2>{p.display_name || p.id}</h2>
                    <p>{p.student_id || "ID not verified"}</p>
                    <Form
                      busy={busy}
                      submit="Verify student ID"
                      action={(f) =>
                        act(() =>
                          save(() =>
                            api.setStudentId({
                              userId: p.id,
                              studentId: f.get("studentId"),
                              identificationChecked: f.get("checked") === "on",
                            }),
                          ),
                        )
                      }
                    >
                      <Field
                        label="Student ID"
                        name="studentId"
                        defaultValue={p.student_id || ""}
                        maxLength={30}
                        required
                      />
                      <label className="live-check">
                        <input name="checked" type="checkbox" required />
                        Physical ID checked
                      </label>
                    </Form>
                  </section>
                ))}
              </>
            )}
            {page === "Users" && roles === "admin" && (
              <>
                <h2>Invite staff</h2>
                <Form
                  busy={busy}
                  submit="Create staff invitation"
                  action={(f) =>
                    act(async () => {
                      const result = await api.provisionStaff({
                        email: f.get("email"),
                        displayName: f.get("name"),
                      });
                      setInvitation(result.invitationUrl);
                      await refresh();
                    }, "Share this private invitation with the intended staff member.")
                  }
                >
                  <Field label="Staff email" name="email" type="email" required />
                  <Field label="Full name" name="name" required maxLength={100} />
                </Form>
                {invitation && (
                  <Field label="Private staff invitation">
                    <input
                      readOnly
                      type="password"
                      value={invitation}
                      onFocus={(e) => {
                        e.currentTarget.type = "text";
                        e.currentTarget.select();
                      }}
                      onBlur={(e) => {
                        e.currentTarget.type = "password";
                      }}
                    />
                  </Field>
                )}
                {data.users.map((u) => (
                  <section key={u.user_id}>
                    <h2>{u.display_name || u.user_id}</h2>
                    <Form
                      busy={busy}
                      action={(f) =>
                        act(() =>
                          save(() =>
                            api.setUserAccess({
                              userId: u.user_id,
                              role: f.get("role"),
                              enabled: f.get("enabled") === "on",
                            }),
                          ),
                        )
                      }
                    >
                      <Field label="Role">
                        <select name="role" defaultValue={u.role}>
                          <option>student</option>
                          <option>staff</option>
                          <option>admin</option>
                        </select>
                      </Field>
                      <label className="live-check">
                        <input type="checkbox" name="enabled" defaultChecked={u.enabled} />
                        Access enabled
                      </label>
                    </Form>
                  </section>
                ))}
              </>
            )}
            {page === "Reports" && roles === "admin" && (
              <>
                <div className="live-line">
                  <Field
                    label="From"
                    type="date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                  <Field
                    label="Through"
                    type="date"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </div>
                {start > end ? (
                  <p role="alert">Choose an end date on or after the start date.</p>
                ) : (
                  <dl className="live-stats">
                    {Object.entries(stats).map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p>
                  Received totals use donation dates. Distribution totals use completed pickups,
                  including every saved lot line.
                </p>
                <button
                  disabled={start > end}
                  onClick={() => {
                    const csv = [
                      "from,through,donations,received,pickups,distributed,students",
                      [
                        start,
                        end,
                        stats.donations,
                        stats.received,
                        stats.pickups,
                        stats.distributed,
                        stats.students,
                      ].join(","),
                    ].join("\r\n");
                    const url = URL.createObjectURL(
                      new Blob([csv], { type: "text/csv;charset=utf-8" }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `pantry-report-${start}-${end}.csv`;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  Export CSV
                </button>
              </>
            )}
            {page === "Audit" && roles === "admin" && (
              <Table headings={["Time", "Actor", "Action", "Record"]}>
                {[
                  ...data.audit.map((a) => ({ ...a, kind: a.action, target: a.record_id })),
                  ...data.accessAudit.map((a) => ({
                    ...a,
                    id: `access-${a.id}`,
                    kind: `Access: ${a.old_role} → ${a.new_role}, enabled ${a.new_enabled}`,
                    target: a.target_id,
                  })),
                  ...data.idAudit.map((a) => ({
                    ...a,
                    id: `identity-${a.id}`,
                    kind: "Student ID verified",
                    target: a.target_id,
                  })),
                ]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .map((a) => (
                    <tr key={a.id}>
                      <td>{time(a.created_at)}</td>
                      <td>{nameOf(data, a.actor_id)}</td>
                      <td>{a.kind}</td>
                      <td>{a.target}</td>
                    </tr>
                  ))}
              </Table>
            )}
            {page === "Account" && (
              <>
                <p>
                  {account.user.email} ·{" "}
                  {account.profile.student_id || "Bring your ID to staff for verification."}
                </p>
                <Form
                  busy={busy}
                  submit="Update profile"
                  action={(f) =>
                    act(() => save(() => api.updateMyProfile({ displayName: f.get("name") })))
                  }
                >
                  <Field
                    label="Full name"
                    name="name"
                    defaultValue={account.profile.display_name}
                    maxLength={100}
                    required
                  />
                </Form>
                <Form
                  busy={busy}
                  submit="Change password"
                  action={(f, form) =>
                    act(async () => {
                      await api.updatePassword(f.get("password"));
                      form.reset();
                    }, "Password updated.")
                  }
                >
                  <Field
                    label="New password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Form>
              </>
            )}
          </>
        )}
      </main>
      <footer>
        Panther Pantry · Saved securely to the pantry backend. Times marked Central use
        America/Chicago.
      </footer>
    </div>
  );
}
