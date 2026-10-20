import { DataLoader } from "../components/Loading.jsx";
import { notifyError } from '../components/Notifications.jsx';
import { useEffect, useRef, useState } from "react";
import { AsyncForm, Badge, Button, Card, EmptyState, Field, Modal, PageHeading } from "../components/ui.jsx";
import { usePersistedState } from "../hooks/usePersistedState.js";
import { initialPickups, initialRequests } from "./StaffRequests.jsx";
import { initialItems, initialSlots } from "./StaffInventory.jsx";
import "./student.css";

const foodCategories = ["Canned goods", "Grains and pasta", "Protein", "Breakfast", "Dairy", "Produce"];
const onHand = item => item.lots.reduce((sum, lot) => sum + Number(lot.quantity), 0);
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
function slotLabel(slot) {
  const [hour, minute] = slot.time.split(":").map(Number);
  const start = new Date(2026, 0, 1, hour, minute);
  const end = new Date(start.getTime() + 30 * 60000);
  const format = date => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${format(start).replace(/ (AM|PM)$/, "")} – ${format(end)}`;
}

export default function Student({ page, navigate, notify, profile, signOut }) {
  const [requests, setRequests] = usePersistedState("panther-staff-requests", initialRequests);
  const [, setPickups] = usePersistedState("panther-staff-pickups", initialPickups);
  const [ownRequestIds, setOwnRequestIds] = usePersistedState("panther-student-request-ids", []);
  const [inventory] = usePersistedState("panther-inventory-v1", initialItems);
  const [slots, setSlots] = usePersistedState("panther-pickup-slots-v1", initialSlots);
  const [foodId, setFoodId] = useState("");
  const [day, setDay] = useState("");
  const [slotId, setSlotId] = useState("");
  const [note, setNote] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const submitting = useRef(false);
  const own = requests.filter(request => ownRequestIds.includes(request.id) && request.studentId === profile.studentId);
  const open = own.find(request => ["Waiting", "Approved"].includes(request.status));
  const past = own.filter(request => !["Waiting", "Approved"].includes(request.status));
  const foods = inventory.filter(item => item.category !== "Personal care" && onHand(item) > 0);
  const food = foods.find(item => item.id === foodId);
  // Keep the design's sample calendar in sync with editable staff mock slots.
  const days = [...new Set(slots.filter(slot => slot.date >= "2026-10-15").map(slot => slot.date))].sort();
  const daySlots = slots.filter(slot => slot.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const selectedSlot = daySlots.find(slot => slot.id === slotId);
  const initials = profile.name.split(" ").map(word => word[0]).slice(0, 2).join("");
  useEffect(() => { setAccountOpen(false); }, [page]);

  function chooseFood(value) {
    setFoodId(value); setDay(""); setSlotId("");
  }
  function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    if (open) { notifyError("You already have an open request. Cancel it before choosing a new pickup."); return; }
    if (!food) { notifyError("Select an available food item."); return; }
    if (!selectedSlot || selectedSlot.booked >= selectedSlot.capacity) { notifyError("Choose an available pickup day and time."); return; }
    submitting.current = true;
    const time = slotLabel(selectedSlot);
    const request = {
      id: `student-${crypto.randomUUID()}`, name: profile.name, studentId: profile.studentId,
      fullPickupDate: dateLabel(day), date: day, slotId, slotReserved: true, slot: time,
      time: new Date(`2026-01-01T${selectedSlot.time}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
      pickup: `${dateLabel(day)} · ${time}`, sent: "Just now", status: "Waiting", note: note.trim(), firstVisit: false,
      foodId: food.id, foodName: food.name, requestedItems: [{ id: food.id, name: food.name, qty: 1 }],
    };
    setRequests(current => [request, ...current]);
    setOwnRequestIds(current => [...current, request.id]);
    setSlots(current => current.map(slot => slot.id === slotId ? { ...slot, booked: slot.booked + 1 } : slot));
    setSubmitted(request);
    setFoodId(""); setDay(""); setSlotId(""); setNote("");
    navigate("/student/home");
    submitting.current = false;
  }
  function cancel() {
    if (!cancelRequest) return;
    setRequests(current => current.map(request => request.id === cancelRequest.id ? { ...request, status: "Cancelled", slotReserved: false } : request));
    setPickups(current => current.filter(pickup => pickup.id !== cancelRequest.id));
    if (cancelRequest.slotReserved && cancelRequest.slotId) {
      setSlots(current => current.map(slot => slot.id === cancelRequest.slotId ? { ...slot, booked: Math.max(0, slot.booked - 1) } : slot));
    }
    setCancelRequest(null);
    notify("Your request was cancelled.");
    navigate("/student/home");
  }

  const requestCard = open && <Card className="student-request-status">
    <div className="student-section-title"><h2>{open.status === "Approved" ? "Your pickup is confirmed" : "Your request is waiting for approval"}</h2><Badge tone={open.status === "Approved" ? "success" : "warning"}>{open.status === "Waiting" ? "Submitted" : open.status}</Badge></div>
    <p className="muted">{open.status === "Approved" ? "Bring your student ID card when you pick up your food." : "Staff will review your request. Check back here for an update."}</p>
    <div className="student-pickup-info">{open.foodName && <div><span>Requested food</span><strong>{open.foodName}</strong></div>}<div><span>Pickup day</span><strong>{open.fullPickupDate}</strong></div><div><span>Pickup time</span><strong>{open.slot}</strong></div></div>
    {open.note && <p><strong>Dietary note:</strong> {open.note}</p>}
    <Button variant="secondary" onClick={() => setCancelRequest(open)}>Cancel request</Button>
  </Card>;

  return <div className="student-app">
    <header className="student-header"><div className="student-header-inner">
      <a className="student-brand" href="#/student/home"><span><img src="/assets/figma/c61c4.svg" alt="" /></span><strong>Panther Pantry</strong></a>
      <nav aria-label="Main">{[["home", "Home"], ["request", "Request food"], ["history", "History"]].map(([path, label]) => <a href={`#/student/${path}`} key={path} aria-current={page === path || (path === "request" && page === "request-status") ? "page" : undefined}>{label}</a>)}</nav>
      <div className="student-account"><button className="student-avatar" aria-label="Account and sign out" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>{initials}</button>{accountOpen && <div className="student-account-menu"><strong>{profile.name}</strong><span>{profile.studentId}</span><Button asyncAction loadingLabel="Signing out…" onClick={signOut}>Sign out</Button></div>}</div>
    </div></header>
    <main className="student-main" id="main-content" tabIndex={-1}><DataLoader queryKey={page} label="Loading your pantry…">
      {page === "home" && <>
        <PageHeading title={`Hi, ${profile.name.split(" ")[0]}`} description={open ? "Here's the latest on your request." : "You have no open request."} />
        <section className="student-cta"><div><h2>Need food this week?</h2><p>Choose your food and pickup time. Staff will confirm your request.</p></div><Button variant="gold" onClick={() => navigate("/student/request")}>Request food</Button></section>
        {requestCard}
        <section><div className="student-section-title"><h2>Available now</h2><span className="muted">Updated today</span></div><ul className="student-availability">{foodCategories.map(category => {
          const items = inventory.filter(item => item.category === category);
          const status = !items.some(item => onHand(item) > 0) ? "Out of stock" : items.some(item => onHand(item) < item.alert) ? "Low stock" : "In stock";
          return <li key={category}><span>{category}</span><Badge>{status}</Badge></li>;
        })}</ul></section>
      </>}
      {page === "request" && <>
        <PageHeading title="Request food" description="Choose your food, then pick a day and time. You can have one open request at a time." />
        {open ? <><p className="notice">You already have an open request. To request a different food or time, cancel it below first.</p>{requestCard}</> : <AsyncForm className="student-request-form" onSubmit={submit}>
          <Card className="student-food-picker"><Field label="Select food" hint="Choose an item from the pantry's available stock."><select required value={foodId} onChange={event => chooseFood(event.target.value)}><option value="">Choose a food item</option>{foods.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>{!foods.length && <p className="muted">No food is available right now. Please check back later.</p>}</Card>
          {food && <>
            <DataLoader queryKey={foodId} label="Loading pickup days…" compact><Card className="student-slot-picker">
              <fieldset><legend>Pick a day</legend><div className="student-days">{days.map(date => <button key={date} type="button" className={day === date ? "selected" : ""} aria-pressed={day === date} aria-label={dateLabel(date)} onClick={() => { setDay(date); setSlotId(""); }}><span>{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span><strong>{Number(date.slice(8))}</strong><span>{new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</span></button>)}</div>{!days.length && <p className="muted">No pickup days are scheduled yet.</p>}</fieldset>
              <fieldset><legend>Pick a time</legend>{day ? <DataLoader queryKey={day} label="Loading pickup times…" compact><div className="student-time-options">{daySlots.map(slot => {
                const remaining = Math.max(0, slot.capacity - slot.booked);
                return <label key={slot.id} className={`student-time-option ${slotId === slot.id ? "selected" : ""} ${!remaining ? "full" : ""}`}><input type="radio" name="pickupTime" value={slot.id} checked={slotId === slot.id} disabled={!remaining} onChange={() => setSlotId(slot.id)} /><span>{slotLabel(slot)}</span>{!remaining ? <Badge>Full</Badge> : <small>{remaining} {remaining === 1 ? "spot" : "spots"} left</small>}</label>;
              })}</div></DataLoader> : <p className="muted">Select a day to see available pickup times.</p>}</fieldset>
            </Card></DataLoader>
            <Card className="student-submit-card"><Field label="Dietary note (optional)" hint="Let staff know about any food allergies or dietary preferences."><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="e.g. Vegetarian, no pork, or food allergies" maxLength={500} rows={2} /></Field><div className="student-submit-actions"><p className="muted">{food.name}{selectedSlot && ` · ${dateLabel(day)} · ${slotLabel(selectedSlot)}`}</p><Button type="submit" loadingLabel="Submitting request…" disabled={!selectedSlot || selectedSlot.booked >= selectedSlot.capacity}>Submit request</Button></div></Card>
          </>}

        </AsyncForm>}
      </>}
      {page === "request-status" && <><PageHeading title="Your request" description="View the status of your pickup." />{requestCard || <Card><EmptyState title="No open request" description="Choose your food and pickup time to request food." /><Button onClick={() => navigate("/student/request")}>Request food</Button></Card>}</>}
      {page === "history" && <>
        <PageHeading title="History" />
        {open && <section><h2>Open request</h2><button className="student-history-open" onClick={() => navigate("/student/request-status")}><span><strong>{open.foodName || open.fullPickupDate}</strong><small>{open.fullPickupDate} · {open.slot}</small></span><Badge>{open.status === "Waiting" ? "Submitted" : open.status}</Badge><span aria-hidden="true">→</span></button></section>}
        <section><h2 className="student-past-heading">Past requests</h2>{past.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Food</th><th>Date</th><th>Pickup time</th><th>Status</th><th>Details</th></tr></thead><tbody>{past.map(request => <tr key={request.id}><td>{request.foodName || "Pantry food"}</td><td>{request.fullPickupDate}</td><td>{request.slot}</td><td><Badge>{request.status}</Badge></td><td>{request.declineReason || "—"}</td></tr>)}</tbody></table></div> : <Card><EmptyState title="No past requests yet" description="Completed, cancelled, and declined requests will appear here." /></Card>}</section>
      </>}
    </DataLoader></main>
    {cancelRequest && <Modal title="Cancel this request?" onClose={() => setCancelRequest(null)} footer={<><Button variant="secondary" onClick={() => setCancelRequest(null)}>Keep request</Button><Button variant="danger" asyncAction loadingLabel="Cancelling request…" onClick={cancel}>Yes, cancel request</Button></>}><p>Your {cancelRequest.foodName ? `request for ${cancelRequest.foodName.toLowerCase()}` : "pickup"} on {cancelRequest.fullPickupDate} at {cancelRequest.slot} will be cancelled. You can choose another pickup afterward.</p></Modal>}
    {submitted && <Modal title="Request submitted" onClose={() => setSubmitted(null)} footer={<Button onClick={() => setSubmitted(null)}>Done</Button>}><div className="student-success"><span className="student-success-mark" aria-hidden="true">✓</span><p>Your request for <strong>{submitted.foodName}</strong> has been sent to pantry staff.</p><p className="muted">{submitted.fullPickupDate} · {submitted.slot}</p><p>Check your home page for approval and pickup updates.</p></div></Modal>}
  </div>;
}
