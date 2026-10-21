export const initialStudents = [
  ["Aaliyah Brown", "P00230417", false, "Sep 3", "Sep 29", "Approved"],
  ["Chris Martinez", "P00265503", false, "", "—", "Submitted"],
  ["Darius King", "P00987654", true, "Oct 14", "Oct 14", ""],
  ["Jordan Ellis", "P00281734", false, "Aug 27", "Oct 1", "Submitted"],
  ["Marcus Johnson", "P00241190", false, "", "—", "Approved"],
  ["Maya Thompson", "P00213345", false, "Sep 2", "Oct 14", ""],
  ["Noah Patel", "P00276620", false, "Sep 10", "Oct 5", "Submitted"],
].map(([name, id, provisional, checked, lastPickup, request]) => ({
  name,
  id,
  provisional,
  checked,
  lastPickup,
  request,
}));
