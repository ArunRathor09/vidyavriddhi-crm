import type { CrmCollection, CrmRecord } from "@/lib/crm/config";

function relativeDate(days: number, includeTime = false) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  if (includeTime) date.setHours(15, 30, 0, 0);
  return includeTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

const records: Record<CrmCollection, CrmRecord[]> = {
  leads: [
    { id: "demo-lead-1", full_name: "Aarav Sharma", phone: "+91 98765 43210", email: "aarav.sharma@example.com", source: "Website", status: "Interested", priority: "Hot", counselor_name: "Priya Shah", preferred_destination: "Georgia", budget: 850000, next_follow_up_date: relativeDate(0), created_at: relativeDate(-1, true) },
    { id: "demo-lead-2", full_name: "Ananya Mehta", phone: "+91 98765 12340", email: "ananya.mehta@example.com", source: "Referral", status: "Documents", priority: "Warm", counselor_name: "Amit Verma", preferred_destination: "Karnataka", budget: 1200000, next_follow_up_date: relativeDate(1), created_at: relativeDate(-2, true) },
    { id: "demo-lead-3", full_name: "Kabir Patel", phone: "+91 98123 45670", email: "kabir.patel@example.com", source: "Instagram", status: "New", priority: "Hot", counselor_name: "Priya Shah", preferred_destination: "Kazakhstan", budget: 720000, next_follow_up_date: relativeDate(0), created_at: relativeDate(-3, true) },
    { id: "demo-lead-4", full_name: "Diya Singh", phone: "+91 98989 76543", email: "diya.singh@example.com", source: "Google", status: "Applied", priority: "Warm", counselor_name: "Neha Gupta", preferred_destination: "Maharashtra", budget: 1500000, next_follow_up_date: relativeDate(2), created_at: relativeDate(-5, true) },
    { id: "demo-lead-5", full_name: "Vivaan Kapoor", phone: "+91 97654 32109", email: "vivaan.kapoor@example.com", source: "Walk-in", status: "Contacted", priority: "Cold", counselor_name: "Amit Verma", preferred_destination: "Uzbekistan", budget: 650000, next_follow_up_date: relativeDate(3), created_at: relativeDate(-7, true) },
  ],
  students: [
    { id: "demo-student-1", full_name: "Aarav Sharma", phone: "+91 98765 43210", email: "aarav.sharma@example.com", parent_name: "Rajesh Sharma", neet_score: 412, rank: 128400, category: "General", preferred_destination: "Georgia", budget: 850000, timeline: "2026 intake", created_at: relativeDate(-2, true) },
    { id: "demo-student-2", full_name: "Ananya Mehta", phone: "+91 98765 12340", email: "ananya.mehta@example.com", parent_name: "Sonal Mehta", neet_score: 528, rank: 48600, category: "OBC", preferred_destination: "Karnataka", budget: 1200000, timeline: "2026 intake", created_at: relativeDate(-4, true) },
    { id: "demo-student-3", full_name: "Diya Singh", phone: "+91 98989 76543", email: "diya.singh@example.com", parent_name: "Amit Singh", neet_score: 462, rank: 98400, category: "General", preferred_destination: "Maharashtra", budget: 1500000, timeline: "2026 intake", created_at: relativeDate(-6, true) },
  ],
  "follow-ups": [
    { id: "demo-followup-1", title: "Counselling call — MBBS options", contact_name: "Aarav Sharma", channel: "Call", due_at: relativeDate(0, true), priority: "High", status: "Open", created_at: relativeDate(-1, true) },
    { id: "demo-followup-2", title: "Review passport documents", contact_name: "Ananya Mehta", channel: "WhatsApp", due_at: relativeDate(0, true), priority: "Medium", status: "Open", created_at: relativeDate(-2, true) },
    { id: "demo-followup-3", title: "Share fee breakdown", contact_name: "Kabir Patel", channel: "Email", due_at: relativeDate(1, true), priority: "Medium", status: "Open", created_at: relativeDate(-3, true) },
    { id: "demo-followup-4", title: "Visa application check-in", contact_name: "Diya Singh", channel: "Call", due_at: relativeDate(-1, true), priority: "High", status: "Completed", created_at: relativeDate(-5, true) },
  ],
  colleges: [
    { id: "demo-college-1", name: "Tbilisi State Medical University", country: "Georgia", state: "Tbilisi", course: "MBBS", annual_fee: 620000, hostel_fee: 180000, seats: 120, cutoff: 120, created_at: relativeDate(-20, true) },
    { id: "demo-college-2", name: "Kasturba Medical College", country: "India", state: "Karnataka", course: "MBBS", annual_fee: 1700000, hostel_fee: 140000, seats: 80, cutoff: 560, created_at: relativeDate(-18, true) },
    { id: "demo-college-3", name: "Astana Medical University", country: "Kazakhstan", state: "Astana", course: "MBBS", annual_fee: 480000, hostel_fee: 110000, seats: 100, cutoff: 120, created_at: relativeDate(-15, true) },
  ],
  applications: [
    { id: "demo-application-1", student_name: "Diya Singh", college_name: "Kasturba Medical College", course: "MBBS", status: "University application", last_updated: relativeDate(-1), created_at: relativeDate(-4, true) },
    { id: "demo-application-2", student_name: "Aarav Sharma", college_name: "Tbilisi State Medical University", course: "MBBS", status: "Document verification", last_updated: relativeDate(-2), created_at: relativeDate(-5, true) },
    { id: "demo-application-3", student_name: "Ananya Mehta", college_name: "Kasturba Medical College", course: "MBBS", status: "Offer letter", last_updated: relativeDate(-3), created_at: relativeDate(-9, true) },
  ],
  documents: [
    { id: "demo-document-1", student_name: "Aarav Sharma", document_type: "NEET scorecard", file_name: "aarav-neet-2026.pdf", verification_status: "Verified", file_path: null, created_at: relativeDate(-1, true) },
    { id: "demo-document-2", student_name: "Ananya Mehta", document_type: "Passport", file_name: "ananya-passport.pdf", verification_status: "Pending", file_path: null, created_at: relativeDate(-2, true) },
    { id: "demo-document-3", student_name: "Diya Singh", document_type: "12th marksheet", file_name: "diya-12th-marksheet.pdf", verification_status: "Needs correction", file_path: null, created_at: relativeDate(-3, true) },
  ],
  payments: [
    { id: "demo-payment-1", student_name: "Ananya Mehta", fee_type: "Registration fee", amount: 25000, status: "Paid", due_date: relativeDate(-2), receipt_number: "NXR-2026-001", created_at: relativeDate(-8, true) },
    { id: "demo-payment-2", student_name: "Diya Singh", fee_type: "Tuition instalment", amount: 120000, status: "Pending", due_date: relativeDate(4), receipt_number: "—", created_at: relativeDate(-6, true) },
    { id: "demo-payment-3", student_name: "Aarav Sharma", fee_type: "Counselling fee", amount: 15000, status: "Overdue", due_date: relativeDate(-1), receipt_number: "—", created_at: relativeDate(-9, true) },
  ],
  activities: [
    { id: "demo-activity-1", description: "Counselling call completed; Georgia MBBS options shared.", student_name: "Aarav Sharma", activity_type: "Call", created_at: relativeDate(0, true) },
    { id: "demo-activity-2", description: "Passport uploaded and awaiting verification.", student_name: "Ananya Mehta", activity_type: "WhatsApp", created_at: relativeDate(-1, true) },
    { id: "demo-activity-3", description: "University application submitted successfully.", student_name: "Diya Singh", activity_type: "Admission", created_at: relativeDate(-2, true) },
  ],
};

export function getDemoRecords(collection: CrmCollection): CrmRecord[] {
  return records[collection].map((record) => ({ ...record }));
}
