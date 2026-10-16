// Drive settings: the one campaign row, edited by the admin. The form's
// input names match the column names exactly, so loading is "copy each
// column into the input with that name" and saving is the reverse. Nothing
// here checks who the caller is — if the database returns no row, the
// caller is not the admin, and the page says so.
import { supabase } from "./auth.js";
import { mountConsole, requireSession } from "./console.js";

const CAMPAIGN_ID = "00000000-0000-4000-a000-000000002026";

const root = document.getElementById("settings-root");
const form = document.getElementById("settings-form");
const status = document.getElementById("settings-status");
const saveStatus = document.getElementById("save-status");

const TEXT_FIELDS = [
  "organization_name", "name", "coordinator_name", "contact_phone",
  "contact_email", "drop_off_address", "drop_off_hours",
  "nominations_open", "nominations_close", "claims_close", "gifts_due",
];

function fillForm(campaign) {
  for (const name of TEXT_FIELDS) {
    form.elements[name].value = campaign[name] ?? "";
  }
  form.elements.sponsor_cap.value = campaign.sponsor_cap;
  form.elements.show_public_count.checked = campaign.show_public_count;
}

function readForm() {
  const values = {};
  for (const name of TEXT_FIELDS) {
    values[name] = form.elements[name].value.trim();
  }
  values.sponsor_cap = Number(form.elements.sponsor_cap.value);
  values.show_public_count = form.elements.show_public_count.checked;
  return values;
}

async function load() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", CAMPAIGN_ID)
    .maybeSingle();

  if (error) {
    status.className = "notice notice-red";
    status.textContent = `Couldn't load the settings: ${error.message}`;
    return;
  }

  // No row and no error means RLS returned nothing: not the admin.
  if (!data) {
    status.className = "notice";
    status.textContent = "There are no settings to show for this account.";
    return;
  }

  fillForm(data);
  status.classList.add("hidden");
  form.classList.remove("hidden");
}

form.onsubmit = async (event) => {
  event.preventDefault();
  saveStatus.textContent = "Saving…";

  const { error } = await supabase
    .from("campaigns")
    .update(readForm())
    .eq("id", CAMPAIGN_ID);

  if (error) {
    // The dates-in-order check and the cap range both come back as errors
    // from the database, which is the right place for them to live.
    saveStatus.textContent = `Not saved: ${error.message}`;
    return;
  }

  saveStatus.textContent = `Saved at ${new Date().toLocaleTimeString()}.`;
};

mountConsole({ title: "Drive settings" });
const session = await requireSession(root);
if (session) await load();
