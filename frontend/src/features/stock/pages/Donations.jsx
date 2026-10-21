import { useDonationForm } from "../hooks/useDonationForm.js";
import { PageHeading } from "../../../components/ui/PageHeading.jsx";
import { AsyncForm } from "../../../components/ui/AsyncForm.jsx";
import { DonorDetails } from "../components/donations/DonorDetails.jsx";
import { DonationItems } from "../components/donations/DonationItems.jsx";
import { Button } from "../../../components/ui/Button.jsx";
import { RecentDonations } from "../components/donations/RecentDonations.jsx";
import { DonationDetailsDialog } from "../components/donations/DonationDetailsDialog.jsx";

export function Donations({ items, setItems, donations, setDonations, navigate, notify }) {
  const {
    save,
    donorRows,
    updateDonor,
    donorOptions,
    donorNames,
    setDonorRows,
    received,
    setReceived,
    detailsReady,
    addItem,
    lines,
    setLines,
    updateLine,
    units,
    setViewing,
    viewing,
  } = useDonationForm({ items, setItems, donations, setDonations, navigate, notify });
  return (
    <>
      <PageHeading
        title="Record donation"
        description="Start with who donated and when, then add the items you received."
      />
      <div className="stock-donation-layout">
        <AsyncForm className="stock-donation-form" onSubmit={save}>
          <DonorDetails
            donorRows={donorRows}
            updateDonor={updateDonor}
            donorOptions={donorOptions}
            donorNames={donorNames}
            setDonorRows={setDonorRows}
            received={received}
            setReceived={setReceived}
          />
          {detailsReady ? (
            <DonationItems
              addItem={addItem}
              lines={lines}
              items={items}
              setLines={setLines}
              updateLine={updateLine}
            />
          ) : (
            <div className="stock-donation-next" role="status">
              <span className="stock-step-number" aria-hidden="true">
                2
              </span>
              <div>
                <strong>Next: items received</strong>
                <p>
                  Complete the donor details and received date to add items.
                  {lines.length > 0 &&
                    " Your item entries are kept while you update these details."}
                </p>
              </div>
            </div>
          )}
          <footer className="stock-donation-footer">
            <div className="stock-donation-total">
              <strong>
                {lines.length} {lines.length === 1 ? "item" : "items"} · {units} units
              </strong>
              <span>Items are added to inventory when you save.</span>
            </div>
            <div className="stock-actions">
              <Button variant="secondary" onClick={() => navigate("/staff/inventory")}>
                Cancel
              </Button>
              <Button
                loadingLabel="Saving…"
                type="submit"
                disabled={!detailsReady || !lines.length}
              >
                Save donation
              </Button>
            </div>
          </footer>
        </AsyncForm>
        <RecentDonations donations={donations} setViewing={setViewing} />
      </div>
      {viewing && <DonationDetailsDialog viewing={viewing} setViewing={setViewing} />}
    </>
  );
}
