import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { Badge } from "../../../components/ui/Badge.jsx";

export function HomePage({ profile, open, navigate, requestCard, availability }) {
  return (
    <>
      <PageHeading
        title={`Hi, ${profile.name.split(" ")[0]}`}
        description={open ? "Here's the latest on your request." : "You have no open request."}
      />
      <section className="student-cta">
        <div>
          <h2>Need food this week?</h2>
          <p>Choose your food and pickup time. Staff will confirm your request.</p>
        </div>
        <Button variant="gold" onClick={() => navigate("/student/request")}>
          Request food
        </Button>
      </section>
      {requestCard}
      <section>
        <div className="student-section-title">
          <h2>Available now</h2>
          <span className="muted">Updated just now</span>
        </div>
        <ul className="student-availability">
          {availability.map(({ category, status }) => (
            <li key={category}>
              <span>{category}</span>
              <Badge>{status}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
