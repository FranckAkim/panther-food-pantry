import { useQuery } from "@tanstack/react-query";
import { keys } from "../../api/keys.js";
import { fetchInventory } from "../../api/inventory.js";
import { fetchDonations, fetchDonors, fetchStudents } from "../../api/operations.js";
import { useSessionState } from "../../hooks/useSessionState.js";
import { DataLoader } from "../../components/loading/DataLoader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { LinkButton } from "./components/LinkButton.jsx";
import { InventoryPage } from "./pages/InventoryPage.jsx";
import { ItemDetail } from "./pages/ItemDetail.jsx";
import { Donations } from "./pages/Donations.jsx";
import { Students } from "./pages/Students.jsx";
import { StudentProfile } from "./pages/StudentProfile.jsx";
import { PickupSlots } from "./pages/PickupSlots.jsx";

function NotFound({ title, description, label, onBack }) {
  return (
    <Card>
      <EmptyState title={title} description={description} />
      <LinkButton underline onClick={onBack}>
        {label}
      </LinkButton>
    </Card>
  );
}

export function StaffInventory({ page, navigate, notify = () => {} }) {
  const inventoryPage = ["inventory", "item-detail", "donations"].includes(page);
  const studentPage = ["students", "student-profile"].includes(page);
  const inventory = useQuery({
    queryKey: keys.inventory,
    queryFn: fetchInventory,
    enabled: inventoryPage,
  });
  const students = useQuery({
    queryKey: keys.students,
    queryFn: fetchStudents,
    enabled: studentPage,
  });
  const donations = useQuery({
    queryKey: keys.donations,
    queryFn: fetchDonations,
    enabled: page === "donations",
  });
  const donors = useQuery({
    queryKey: keys.donors,
    queryFn: fetchDonors,
    enabled: page === "donations",
  });
  const [selectedItem, setSelectedItem] = useSessionState("panther-selected-item", null);
  const [selectedStudent, setSelectedStudent] = useSessionState("panther-selected-student", null);
  const items = inventory.data || [];
  const showItem = (itemId) => {
    setSelectedItem(itemId);
    navigate("/staff/item-detail");
  };
  const showStudent = (studentId) => {
    setSelectedStudent(studentId);
    navigate("/staff/student-profile");
  };
  const common = { navigate, notify };
  const item = items.find((candidate) => candidate.id === selectedItem);
  const student = (students.data || []).find((candidate) => candidate.id === selectedStudent);
  return (
    <div className="stock-pages">
      {page === "inventory" && (
        <DataLoader queries={inventory} label="Loading inventory…">
          <InventoryPage {...common} items={items} showItem={showItem} />
        </DataLoader>
      )}
      {page === "item-detail" && (
        <DataLoader queries={inventory} label="Loading item…">
          {item ? (
            <ItemDetail {...common} item={item} items={items} />
          ) : (
            <NotFound
              title="Item not found"
              description="Choose an item from the inventory list."
              label="Back to inventory"
              onBack={() => navigate("/staff/inventory")}
            />
          )}
        </DataLoader>
      )}
      {page === "donations" && (
        <DataLoader queries={[inventory, donations, donors]} label="Loading donations…">
          <Donations
            {...common}
            items={items}
            donations={donations.data || []}
            donors={donors.data || []}
          />
        </DataLoader>
      )}
      {page === "students" && (
        <DataLoader queries={students} label="Loading students…">
          <Students {...common} students={students.data || []} showStudent={showStudent} />
        </DataLoader>
      )}
      {page === "student-profile" && (
        <DataLoader queries={students} label="Loading student…">
          {student ? (
            <StudentProfile {...common} student={student} />
          ) : (
            <NotFound
              title="Student not found"
              description="Choose a student from the list."
              label="Back to students"
              onBack={() => navigate("/staff/students")}
            />
          )}
        </DataLoader>
      )}
      {(page === "slots" || page === "pickup-slots") && <PickupSlots {...common} />}
    </div>
  );
}
