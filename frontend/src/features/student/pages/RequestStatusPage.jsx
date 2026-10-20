import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { Card } from "../../../components/ui/Card.jsx";
import { EmptyState } from "../../../components/ui/EmptyState.jsx";
import { Button } from "../../../components/ui/Button.jsx";

export function RequestStatusPage({ requestCard, navigate }) {
  return (
    <>
      <PageHeading title="Your request" description="View the status of your pickup." />
      {requestCard || (
        <Card>
          <EmptyState
            title="No open request"
            description="Choose your food and pickup time to request food."
          />
          <Button onClick={() => navigate("/student/request")}>Request food</Button>
        </Card>
      )}
    </>
  );
}
