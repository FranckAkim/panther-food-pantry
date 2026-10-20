import { Fragment } from "react";
import { Field } from "../../../../components/ui/Field.jsx";
import { Asset } from "../Asset.jsx";
import removeIcon from "../../../../assets/stock-remove.svg";
import { DateInput } from "../DateInput.jsx";
import { Button } from "../../../../components/ui/Button.jsx";
import { id } from "../../utils/formatters.js";
import plusPurple from "../../../../assets/stock-plus-purple.svg";

export function DonorDetails({
  donorRows,
  updateDonor,
  donorOptions,
  donorNames,
  setDonorRows,
  received,
  setReceived,
}) {
  return (
    <section className="stock-donation-section" aria-labelledby="donation-details-title">
      <header className="stock-donation-step">
        <span className="stock-step-number" aria-hidden="true">
          1
        </span>
        <div>
          <h2 id="donation-details-title">Donation details</h2>
          <p>Select one or more donors and the date you received the donation.</p>
        </div>
      </header>
      <div className="stock-donor-fields">
        {donorRows.map((row, index) => (
          <Fragment key={row.id}>
            <div className={`stock-donor-row${index > 0 ? " stock-additional-donor" : ""}`}>
              <Field label={index === 0 ? "Donor" : `Donor ${index + 1}`}>
                <select
                  className="select"
                  required
                  value={row.choice}
                  onChange={(e) => updateDonor(row.id, { choice: e.target.value })}
                >
                  <option value="">Choose a donor</option>
                  {donorOptions.map((name) => (
                    <option
                      key={name}
                      value={`donor:${name}`}
                      disabled={donorNames.some(
                        (selected, otherIndex) =>
                          otherIndex !== index && selected.toLowerCase() === name.toLowerCase(),
                      )}
                    >
                      {name}
                    </option>
                  ))}
                  <option value="other">Other</option>
                </select>
              </Field>
              {donorRows.length > 1 && (
                <button
                  className="stock-icon-button"
                  type="button"
                  aria-label={`Remove donor ${index + 1}`}
                  onClick={() =>
                    setDonorRows((rows) => rows.filter((donorRow) => donorRow.id !== row.id))
                  }
                >
                  <Asset src={removeIcon} />
                </button>
              )}
            </div>
            {index === 0 && (
              <Field label="Received on">
                <DateInput
                  aria-label="Received on"
                  required
                  value={received}
                  onChange={(e) => setReceived(e.target.value)}
                />
              </Field>
            )}
            {row.choice === "other" && (
              <Field
                label={index === 0 ? "Donor name" : `Donor ${index + 1} name`}
                className="stock-other-donor"
              >
                <input
                  className="input"
                  name={`donorName-${row.id}`}
                  placeholder="Enter the donor's name"
                  required
                  value={row.name}
                  onChange={(e) => updateDonor(row.id, { name: e.target.value })}
                />
              </Field>
            )}
          </Fragment>
        ))}
        <Button
          className="stock-add-donor"
          variant="secondary"
          type="button"
          onClick={() => setDonorRows((rows) => [...rows, { id: id(), choice: "", name: "" }])}
        >
          <Asset src={plusPurple} />
          Add another donor
        </Button>
      </div>
    </section>
  );
}
