export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "datetime-local"
  | "select"
  | "checkbox"
  | "textarea"
  | "file";

export type CrmField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  placeholder?: string;
};

export const crmModules = {
  leads: {
    title: "Leads",
    singular: "lead",
    eyebrow: "STUDENT CRM",
    description:
      "Capture enquiries, prioritise high-intent students, and keep every counselling conversation moving.",
    table: "leads",
    searchKeys: ["full_name", "phone", "email", "preferred_destination", "counselor_name"],
    facets: [{ key: "priority", label: "Priority" }, { key: "source", label: "Source" }],
    columns: [
      { key: "full_name", label: "Student", primary: true },
      { key: "phone", label: "Phone" },
      { key: "preferred_destination", label: "Preferred destination" },
      { key: "source", label: "Source" },
      { key: "counselor_name", label: "Counsellor" },
      { key: "status", label: "Pipeline" },
      { key: "whatsapp_opt_in", label: "WhatsApp consent" },
      { key: "next_follow_up_date", label: "Next follow-up", type: "date" },
    ],
    fields: [
      { key: "full_name", label: "Student name", type: "text", required: true },
      { key: "phone", label: "Phone number", type: "tel", required: true },
      { key: "email", label: "Email address", type: "email" },
      { key: "source", label: "Lead source", type: "select", options: ["Website", "Google", "Facebook", "Instagram", "Referral", "Walk-in", "Other"], required: true },
      { key: "status", label: "Pipeline stage", type: "select", options: ["New", "Contacted", "Interested", "Documents", "Applied", "Offer letter", "Admitted", "Payment complete"], required: true },
      { key: "priority", label: "Priority", type: "select", options: ["Hot", "Warm", "Cold"], required: true },
      { key: "whatsapp_opt_in", label: "Student has opted in to WhatsApp messages", type: "checkbox" },
      { key: "counselor_name", label: "Assigned counsellor", type: "text", placeholder: "Team member name" },
      { key: "preferred_destination", label: "Preferred country / state", type: "text", placeholder: "e.g. Georgia or Karnataka" },
      { key: "budget", label: "Annual budget (₹)", type: "number" },
      { key: "next_follow_up_date", label: "Next follow-up", type: "date" },
    ],
  },
  students: {
    title: "Students",
    singular: "student",
    eyebrow: "STUDENT 360°",
    description:
      "Keep a complete, counsellor-ready student profile with NEET details, family contacts, and preferences.",
    table: "students",
    searchKeys: ["full_name", "phone", "email", "parent_name", "preferred_destination"],
    columns: [
      { key: "full_name", label: "Student", primary: true },
      { key: "phone", label: "Phone" },
      { key: "neet_score", label: "NEET score" },
      { key: "category", label: "Category" },
      { key: "preferred_destination", label: "Destination" },
      { key: "budget", label: "Budget", type: "currency" },
    ],
    fields: [
      { key: "full_name", label: "Student name", type: "text", required: true },
      { key: "phone", label: "Phone number", type: "tel", required: true },
      { key: "email", label: "Email address", type: "email" },
      { key: "parent_name", label: "Parent / guardian", type: "text" },
      { key: "neet_score", label: "NEET score", type: "number" },
      { key: "rank", label: "NEET rank", type: "number" },
      { key: "category", label: "Category", type: "select", options: ["General", "OBC", "SC", "ST", "EWS", "Other"] },
      { key: "preferred_destination", label: "Preferred country / state", type: "text" },
      { key: "budget", label: "Annual budget (₹)", type: "number" },
      { key: "timeline", label: "Admission timeline", type: "text", placeholder: "e.g. 2026 intake" },
      { key: "notes", label: "Counsellor notes", type: "textarea" },
    ],
  },
  "follow-ups": {
    title: "Follow-ups",
    singular: "follow-up",
    eyebrow: "COUNSELLOR WORKSPACE",
    description:
      "Stay ahead of callbacks, counselling sessions, and overdue reminders across your student pipeline.",
    table: "follow_ups",
    searchKeys: ["title", "contact_name", "channel", "notes"],
    columns: [
      { key: "title", label: "Follow-up", primary: true },
      { key: "contact_name", label: "Student" },
      { key: "channel", label: "Channel" },
      { key: "due_at", label: "Due", type: "datetime" },
      { key: "priority", label: "Priority" },
      { key: "status", label: "Status" },
    ],
    fields: [
      { key: "title", label: "Follow-up task", type: "text", required: true },
      { key: "contact_name", label: "Student name", type: "text", required: true },
      { key: "channel", label: "Contact method", type: "select", options: ["Call", "WhatsApp", "Email", "Meeting", "SMS"], required: true },
      { key: "due_at", label: "Due date & time", type: "datetime-local", required: true },
      { key: "priority", label: "Priority", type: "select", options: ["High", "Medium", "Low"], required: true },
      { key: "status", label: "Status", type: "select", options: ["Open", "Completed", "Snoozed"], required: true },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  colleges: {
    title: "Colleges",
    singular: "college",
    eyebrow: "COLLEGE DIRECTORY",
    description:
      "Compare programmes, tuition, accommodation, eligibility, and admission cut-offs in one place.",
    table: "colleges",
    searchKeys: ["name", "country", "state", "course"],
    facets: [{ key: "country", label: "Country" }, { key: "course", label: "Course" }],
    columns: [
      { key: "name", label: "College / university", primary: true },
      { key: "country", label: "Country" },
      { key: "course", label: "Course" },
      { key: "annual_fee", label: "Annual tuition", type: "currency" },
      { key: "seats", label: "Seats" },
      { key: "cutoff", label: "NEET cut-off" },
    ],
    fields: [
      { key: "name", label: "College / university", type: "text", required: true },
      { key: "country", label: "Country", type: "text", required: true },
      { key: "state", label: "State / region", type: "text" },
      { key: "course", label: "Course", type: "text", required: true },
      { key: "annual_fee", label: "Annual tuition (₹)", type: "number" },
      { key: "hostel_fee", label: "Annual hostel fee (₹)", type: "number" },
      { key: "seats", label: "Available seats", type: "number" },
      { key: "cutoff", label: "NEET cut-off", type: "number" },
      { key: "eligibility", label: "Eligibility", type: "textarea" },
    ],
  },
  applications: {
    title: "Applications",
    singular: "application",
    eyebrow: "ADMISSION TRACKER",
    description:
      "Track each application from registration and document checks through offers, visas, and enrolment.",
    table: "applications",
    searchKeys: ["student_name", "college_name", "course", "status"],
    columns: [
      { key: "student_name", label: "Student", primary: true },
      { key: "college_name", label: "College / university" },
      { key: "course", label: "Course" },
      { key: "status", label: "Application stage" },
      { key: "last_updated", label: "Last updated", type: "date" },
    ],
    fields: [
      { key: "student_name", label: "Student name", type: "text", required: true },
      { key: "college_name", label: "College / university", type: "text", required: true },
      { key: "course", label: "Course", type: "text", required: true },
      { key: "status", label: "Application stage", type: "select", options: ["Registration", "Document verification", "University application", "Offer letter", "Visa", "Admitted", "Rejected"], required: true },
      { key: "last_updated", label: "Last updated", type: "date", required: true },
      { key: "notes", label: "Application notes", type: "textarea" },
    ],
  },
  documents: {
    title: "Documents",
    singular: "document",
    eyebrow: "SECURE DOCUMENT VAULT",
    description:
      "Organise student identity and academic documents and keep verification status visible to the team.",
    table: "documents",
    searchKeys: ["student_name", "document_type", "file_name", "verification_status"],
    columns: [
      { key: "student_name", label: "Student", primary: true },
      { key: "document_type", label: "Document" },
      { key: "file_name", label: "File" },
      { key: "verification_status", label: "Verification" },
      { key: "created_at", label: "Uploaded", type: "date" },
    ],
    fields: [
      { key: "student_name", label: "Student name", type: "text", required: true },
      { key: "document_type", label: "Document type", type: "select", options: ["NEET scorecard", "10th marksheet", "12th marksheet", "Aadhaar", "Passport", "Photo", "Signature", "Other"], required: true },
      { key: "document_file", label: "Document file", type: "file", placeholder: "PDF or image · maximum 10 MB" },
      { key: "verification_status", label: "Verification status", type: "select", options: ["Pending", "Verified", "Needs correction"], required: true },
    ],
  },
  payments: {
    title: "Payments",
    singular: "payment",
    eyebrow: "FEE & COLLECTIONS",
    description:
      "Monitor registration fees, instalments, outstanding balances, due dates, and receipt references.",
    table: "payments",
    searchKeys: ["student_name", "fee_type", "receipt_number", "status"],
    columns: [
      { key: "student_name", label: "Student", primary: true },
      { key: "fee_type", label: "Fee type" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "status", label: "Status" },
      { key: "due_date", label: "Due date", type: "date" },
      { key: "receipt_number", label: "Receipt" },
    ],
    fields: [
      { key: "student_name", label: "Student name", type: "text", required: true },
      { key: "fee_type", label: "Fee / instalment", type: "select", options: ["Registration fee", "Counselling fee", "Tuition instalment", "Visa fee", "Other"], required: true },
      { key: "amount", label: "Amount (₹)", type: "number", required: true },
      { key: "status", label: "Payment status", type: "select", options: ["Pending", "Paid", "Overdue", "Partially paid"], required: true },
      { key: "due_date", label: "Due date", type: "date" },
      { key: "receipt_number", label: "Receipt number", type: "text" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  activities: {
    title: "Activities",
    singular: "activity",
    eyebrow: "TEAM TIMELINE",
    description:
      "Review calls, counselling sessions, messages, and admissions milestones recorded by your team.",
    table: "activities",
    searchKeys: ["description", "student_name", "activity_type"],
    columns: [
      { key: "description", label: "Activity", primary: true },
      { key: "student_name", label: "Student" },
      { key: "activity_type", label: "Type" },
      { key: "created_at", label: "Recorded", type: "datetime" },
    ],
    fields: [
      { key: "description", label: "Activity details", type: "textarea", required: true },
      { key: "student_name", label: "Student name", type: "text" },
      { key: "activity_type", label: "Activity type", type: "select", options: ["Call", "WhatsApp", "Email", "Meeting", "Note", "Admission"], required: true },
    ],
  },
} as const;

export type CrmCollection = keyof typeof crmModules;
export type CrmRecord = {
  id: string;
  created_at?: string;
  [key: string]: unknown;
};

export function isCrmCollection(value: string): value is CrmCollection {
  return Object.hasOwn(crmModules, value);
}
