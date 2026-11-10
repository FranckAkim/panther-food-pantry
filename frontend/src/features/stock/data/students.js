import { demoPeople } from "../../demo/people.js";
import { expandedRequests } from "../../demo/records.js";

export const initialStudents = [
  ["Aaliyah Brown", "P00230417", false, "Sep 3", "Sep 29", "Approved"],
  ["Chris Martinez", "P00265503", false, "", "—", "Submitted"],
  ["Darius King", "P00987654", true, "Oct 14", "Oct 14", ""],
  ["Jordan Ellis", "P00281734", false, "Aug 27", "Oct 1", "Submitted"],
  ["Marcus Johnson", "P00241190", false, "", "—", "Approved"],
  ["Maya Thompson", "P00213345", false, "Sep 2", "Oct 14", ""],
  ["Noah Patel", "P00276620", false, "Sep 10", "Oct 5", "Submitted"],
]
  .map(([name, id, provisional, checked, lastPickup, request]) => ({
    name,
    id,
    provisional,
    checked,
    lastPickup,
    request,
  }))
  .concat(
    demoPeople.map((person, index) => {
      const status = expandedRequests[index].status;
      return {
        name: person.name,
        id: person.id,
        provisional: index % 13 === 0,
        checked: index % 13 === 0 ? "" : "Oct 12",
        lastPickup: status === "Completed" ? "Oct 14" : index % 4 === 0 ? "Sep 24" : "—",
        request: status === "Waiting" ? "Submitted" : status === "Approved" ? "Approved" : "",
      };
    }),
  );
