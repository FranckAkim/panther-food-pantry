// Shared backend integration for PFPMS-1–4. Inject the Supabase client for testing.
export function createPantryApi(client) {
  const unwrap = ({ data, error }) => {
    if (error) throw error;
    return data;
  };
  async function currentUser() {
    const response = await client.auth.getUser();
    if (response.error?.name === "AuthSessionMissingError") return null;
    const { user } = unwrap(response);
    if (!user) return null;
    const access = unwrap(await client.rpc("my_access"))?.[0];
    if (!access?.enabled)
      throw new Error("Your pantry access is disabled. Contact an administrator.");
    const profile = unwrap(await client.from("profiles").select("*").eq("id", user.id).single());
    return { user, profile, role: access.role };
  }
  return {
    onAuthChange(callback) {
      const { data } = client.auth.onAuthStateChange((event) => callback(event));
      return () => data.subscription.unsubscribe();
    },
    async requestPasswordReset(email, redirectTo) {
      return unwrap(await client.auth.resetPasswordForEmail(email.trim(), { redirectTo }));
    },
    async updatePassword(password) {
      return unwrap(await client.auth.updateUser({ password }));
    },
    async listRecords(table) {
      const allowed = [
        "profiles",
        "food_requests",
        "inventory_items",
        "inventory_lots",
        "stock_adjustments",
        "donations",
        "donation_lines",
        "pickup_lines",
        "operations_audit",
        "access_audit",
        "student_id_audit",
      ];
      if (!allowed.includes(table)) throw new Error("Unsupported record type.");
      const rows = [];
      for (let offset = 0; ; offset += 500) {
        const page = unwrap(
          await client
            .from(table)
            .select("*")
            .order("id")
            .range(offset, offset + 499),
        );
        rows.push(...page);
        if (page.length < 500) return rows;
      }
    },
    async pickupSlots() {
      return unwrap(await client.rpc("list_pickup_slots"));
    },
    async studentDirectory() {
      return unwrap(await client.rpc("student_directory"));
    },
    async createWalkIn({ id, studentId, categories }) {
      return unwrap(
        await client.rpc("create_walk_in", {
          p_id: id,
          p_student: studentId,
          p_categories: categories,
        }),
      );
    },
    async savePickupSlot({ id = null, startsAt, capacity, active = true }) {
      return unwrap(
        await client.rpc("save_pickup_slot", {
          p_id: id,
          p_starts_at: startsAt,
          p_capacity: capacity,
          p_active: active,
        }),
      );
    },
    async reserveRequest({ id, categories, slotId, note = "" }) {
      return unwrap(
        await client.rpc("submit_food_request", {
          p_id: id,
          p_categories: categories,
          p_slot_id: slotId,
          p_note: note,
        }),
      );
    },
    async transitionRequest({ id, status, note = "" }) {
      return unwrap(
        await client.rpc("transition_food_request", { p_id: id, p_status: status, p_note: note }),
      );
    },
    async receiveDonation({ id, donor, receivedDate, lines }) {
      return unwrap(
        await client.rpc("receive_donation", {
          p_id: id,
          p_donor: donor,
          p_received: receivedDate,
          p_lines: lines,
        }),
      );
    },
    async completePickup({ requestId, lines, idChecked }) {
      return unwrap(
        await client.rpc("complete_pickup", {
          p_request_id: requestId,
          p_lines: lines,
          p_id_checked: idChecked,
        }),
      );
    },
    async registerStudent({ email, password, displayName = "" }) {
      if (!/^[^@\s]+@pvamu\.edu$/i.test(email.trim())) {
        throw new Error("Use your pvamu.edu email address.");
      }
      return unwrap(
        await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { display_name: displayName } },
        }),
      );
    },
    async signIn({ email, password, workspace = "student" }) {
      if (!["student", "staff", "admin"].includes(workspace)) throw new Error("Invalid workspace.");
      unwrap(await client.auth.signInWithPassword({ email: email.trim(), password }));
      try {
        const account = await currentUser();
        const allowed = workspace === "staff" ? ["staff", "admin"] : [workspace];
        if (!account || !allowed.includes(account.role))
          throw new Error("This account cannot access that workspace.");
        return account;
      } catch (error) {
        await client.auth.signOut({ scope: "local" });
        throw error;
      }
    },
    async signOut() {
      unwrap(await client.auth.signOut({ scope: "local" }));
    },
    currentUser,
    async updateMyProfile({ displayName }) {
      const account = await currentUser();
      if (!account) throw new Error("Sign in first.");
      return unwrap(
        await client
          .from("profiles")
          .update({ display_name: displayName })
          .eq("id", account.user.id)
          .select()
          .single(),
      );
    },
    async setStudentId({ userId, studentId, identificationChecked = false }) {
      if (identificationChecked !== true) throw new Error("Check the physical student ID first.");
      return unwrap(
        await client.rpc("staff_set_student_id", {
          target: userId,
          new_student_id: studentId,
          identification_checked: true,
        }),
      );
    },
    async listUsers() {
      return unwrap(await client.rpc("admin_list_users"));
    },
    async provisionStaff({ email, displayName = "" }) {
      return unwrap(
        await client.functions.invoke("provision-staff", { body: { email, displayName } }),
      );
    },
    async setUserAccess({ userId, role, enabled }) {
      return unwrap(
        await client.rpc("admin_set_access", {
          target_user_id: userId,
          new_role: role,
          new_enabled: enabled,
        }),
      );
    },
    async submitRequest({ categories, pickupNote = "", slotId, id = crypto.randomUUID() }) {
      if (
        !Array.isArray(categories) ||
        categories.length < 1 ||
        categories.length > 10 ||
        categories.some((value) => typeof value !== "string" || !value.trim() || value.length > 100)
      ) {
        throw new Error("Choose between 1 and 10 food categories.");
      }
      if (typeof pickupNote !== "string" || pickupNote.length > 500)
        throw new Error("Pickup note must be at most 500 characters.");
      if (!slotId) throw new Error("Choose a pickup slot.");
      return unwrap(
        await client.rpc("submit_food_request", {
          p_id: id,
          p_categories: [...new Set(categories.map((value) => value.trim()))],
          p_note: pickupNote,
          p_slot_id: slotId,
        }),
      );
    },
    async myRequests() {
      const account = await currentUser();
      if (!account) throw new Error("Sign in first.");
      return unwrap(
        await client
          .from("food_requests")
          .select("*")
          .eq("student_id", account.user.id)
          .order("created_at", { ascending: false }),
      );
    },
    async createItem({ name, category, unit = "each", active = true }) {
      return unwrap(
        await client
          .from("inventory_items")
          .insert({ name, category, unit, active })
          .select()
          .single(),
      );
    },
    async updateItem(itemId, { name, category, unit, active }) {
      const fields = Object.fromEntries(
        Object.entries({ name, category, unit, active }).filter(([, value]) => value !== undefined),
      );
      return unwrap(
        await client.from("inventory_items").update(fields).eq("id", itemId).select().single(),
      );
    },
    async listItems() {
      return unwrap(await client.from("inventory_items").select("*").order("name"));
    },
    async createLot({ itemId, quantity, storageLocation, receivedDate, expiryDate = null }) {
      return unwrap(
        await client.rpc("create_inventory_lot", {
          p_item_id: itemId,
          p_quantity: quantity,
          p_storage_location: storageLocation,
          p_received_date: receivedDate,
          p_expiry_date: expiryDate,
        }),
      );
    },
    async updateLot(lotId, { storageLocation, receivedDate, expiryDate }) {
      const fields = Object.fromEntries(
        Object.entries({
          storage_location: storageLocation,
          received_date: receivedDate,
          expiry_date: expiryDate,
        }).filter(([, value]) => value !== undefined),
      );
      return unwrap(
        await client.from("inventory_lots").update(fields).eq("id", lotId).select().single(),
      );
    },
    async listLots() {
      return unwrap(
        await client.from("inventory_lots").select("*").order("created_at", { ascending: false }),
      );
    },
    async adjustStock({ lotId, delta, reason }) {
      return unwrap(
        await client.rpc("adjust_inventory_stock", {
          p_lot_id: lotId,
          p_delta: delta,
          p_reason: reason,
        }),
      );
    },
    async stockHistory(lotId) {
      return unwrap(
        await client.from("stock_adjustments").select("*").eq("lot_id", lotId).order("id"),
      );
    },
    async availableInventory() {
      return unwrap(await client.rpc("available_inventory"));
    },
  };
}
