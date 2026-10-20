import { usePersistedState } from "../../hooks/usePersistedState.js";
import { initialItems } from "./data/inventory.js";
import { initialStudents } from "./data/students.js";
import { initialDonations } from "./data/donations.js";
import { InventoryPage } from "./pages/InventoryPage.jsx";
import { ItemDetail } from "./pages/ItemDetail.jsx";
import { Donations } from "./pages/Donations.jsx";
import { Students } from "./pages/Students.jsx";
import { StudentProfile } from "./pages/StudentProfile.jsx";
import { PickupSlots } from "./pages/PickupSlots.jsx";

export function StaffInventory({ page, navigate, notify = () => {} }) {
  const [items, setItems] = usePersistedState("panther-inventory-v1", initialItems);
  const [students, setStudents] = usePersistedState("panther-students-v1", initialStudents);
  const [donations, setDonations] = usePersistedState("panther-donations-v1", initialDonations);
  const [selectedItem, setSelectedItem] = usePersistedState("panther-selected-item", "black-beans");
  const [selectedStudent, setSelectedStudent] = usePersistedState(
    "panther-selected-student",
    "P00987654",
  );
  const showItem = (itemId) => {
    setSelectedItem(itemId);
    navigate("/staff/item-detail");
  };
  const showStudent = (studentId) => {
    setSelectedStudent(studentId);
    navigate("/staff/student-profile");
  };
  const common = { navigate, notify };
  return (
    <div className="stock-pages">
      {page === "inventory" && (
        <InventoryPage {...common} items={items} setItems={setItems} showItem={showItem} />
      )}
      {page === "item-detail" && (
        <ItemDetail
          {...common}
          item={items.find((i) => i.id === selectedItem) || items[0]}
          setItems={setItems}
        />
      )}
      {page === "donations" && (
        <Donations
          {...common}
          items={items}
          setItems={setItems}
          donations={donations}
          setDonations={setDonations}
        />
      )}
      {page === "students" && (
        <Students
          {...common}
          students={students}
          setStudents={setStudents}
          showStudent={showStudent}
        />
      )}
      {page === "student-profile" && (
        <StudentProfile
          {...common}
          student={students.find((s) => s.id === selectedStudent) || students[0]}
          setStudents={setStudents}
        />
      )}
      {(page === "slots" || page === "pickup-slots") && <PickupSlots {...common} />}
    </div>
  );
}
