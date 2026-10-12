export const stats = [
  { title: "Total Revenue", value: "₹48.2L", change: 12.5, hint: "vs last month" },
  { title: "New Leads", value: "342", change: 8.1, hint: "vs last month" },
  { title: "Open Deals", value: "86", change: -3.2, hint: "vs last month" },
  { title: "Conversion Rate", value: "24.8%", change: 2.4, hint: "vs last month" },
];

// values lakhs mein
export const revenueData = [
  { month: "Jan", revenue: 22, target: 25 },
  { month: "Feb", revenue: 28, target: 28 },
  { month: "Mar", revenue: 25, target: 30 },
  { month: "Apr", revenue: 34, target: 32 },
  { month: "May", revenue: 31, target: 34 },
  { month: "Jun", revenue: 40, target: 36 },
  { month: "Jul", revenue: 38, target: 38 },
  { month: "Aug", revenue: 45, target: 40 },
  { month: "Sep", revenue: 48, target: 42 },
];

export const pipelineStages = [
  { name: "New", deals: 32, value: 1850000 },
  { name: "Qualified", deals: 24, value: 1420000 },
  { name: "Proposal", deals: 16, value: 980000 },
  { name: "Negotiation", deals: 9, value: 640000 },
  { name: "Won", deals: 5, value: 410000 },
];

export type DealStage = "New" | "Qualified" | "Proposal" | "Negotiation" | "Won";

export const recentDeals: {
  id: string;
  title: string;
  customer: string;
  stage: DealStage;
  value: number;
  owner: string;
}[] = [
  { id: "D-1024", title: "Website Redesign", customer: "Acme Corp", stage: "Negotiation", value: 450000, owner: "Rohit Sharma" },
  { id: "D-1023", title: "CRM Integration", customer: "TechNova", stage: "Proposal", value: 820000, owner: "Priya Singh" },
  { id: "D-1022", title: "Annual Support Plan", customer: "BlueWave", stage: "Won", value: 240000, owner: "Amit Verma" },
  { id: "D-1021", title: "Mobile App Build", customer: "Zenith Labs", stage: "Qualified", value: 1200000, owner: "Neha Gupta" },
  { id: "D-1020", title: "Cloud Migration", customer: "Orbit Systems", stage: "New", value: 560000, owner: "Rohit Sharma" },
];

export const tasks = [
  { id: 1, title: "Follow up with TechNova", due: "Aaj, 4:00 PM", priority: "High" },
  { id: 2, title: "Send proposal to Zenith Labs", due: "Kal, 11:00 AM", priority: "Urgent" },
  { id: 3, title: "Demo call with Orbit Systems", due: "Kal, 3:30 PM", priority: "Medium" },
  { id: 4, title: "Update pipeline stages", due: "Fri, 10:00 AM", priority: "Low" },
];

export const activities = [
  { id: 1, type: "call", text: "Priya ne TechNova ko call kiya", time: "10 min pehle" },
  { id: 2, type: "deal", text: "BlueWave ki deal Won ho gayi 🎉", time: "1 ghanta pehle" },
  { id: 3, type: "email", text: "Amit ne Acme Corp ko proposal bheja", time: "3 ghante pehle" },
  { id: 4, type: "meeting", text: "Zenith Labs ke saath meeting schedule hui", time: "Kal" },
  { id: 5, type: "note", text: "Neha ne Orbit Systems pe note add kiya", time: "Kal" },
];