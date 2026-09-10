export interface DemoRequestLead {
  id: string;
  ticketId: string;
  fullName: string;
  email: string;
  phone: string;
  community: string;
  units: string;
  role: string;
  product: string;
  status: "New" | "Contacted" | "Demo Scheduled" | "Onboarded";
  createdAt: string;
}

const STORAGE_KEY = "gatesphere_demo_requests";

const INITIAL_DEMO_LEADS: DemoRequestLead[] = [
  {
    id: "lead-101",
    ticketId: "#GS-DEMO-8492",
    fullName: "Rajan Pillai",
    email: "rajan.pillai@prestigegreens.in",
    phone: "+91 98450 12345",
    community: "Prestige Greens Residency",
    units: "500 – 1,000 Units",
    role: "RWA President / Secretary",
    product: "Full Platform (Gate, Residents, Dues & Maintenance)",
    status: "Demo Scheduled",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "lead-102",
    ticketId: "#GS-DEMO-6320",
    fullName: "Priya Nambiar",
    email: "priya.n@sobhabreeze.com",
    phone: "+91 98860 54321",
    community: "Sobha Breeze Palm Township",
    units: "1,000+ Units (Township)",
    role: "Management Committee Member",
    product: "Visitor & Vehicle Gate Management Only",
    status: "New",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "lead-103",
    ticketId: "#GS-DEMO-3195",
    fullName: "Sunil Krishnamurthy",
    email: "sunil.k@brigadegateway.org",
    phone: "+91 99000 87654",
    community: "Brigade Gateway Enclave",
    units: "100 – 500 Units",
    role: "Estate / Facility Manager",
    product: "Automated Society Billing & Accounting",
    status: "Contacted",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
];

export function getStoredDemoRequests(): DemoRequestLead[] {
  if (typeof window === "undefined") return INITIAL_DEMO_LEADS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DEMO_LEADS));
      return INITIAL_DEMO_LEADS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DEMO_LEADS;
  } catch {
    return INITIAL_DEMO_LEADS;
  }
}

export function saveDemoRequest(lead: Omit<DemoRequestLead, "id" | "createdAt" | "status">): DemoRequestLead {
  const newLead: DemoRequestLead = {
    ...lead,
    id: `lead-${Date.now()}`,
    status: "New",
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getStoredDemoRequests();
      const updated = [newLead, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event("demo-requests-updated"));
    } catch (e) {
      console.error("Failed to store demo request", e);
    }
  }

  return newLead;
}

export function updateDemoRequestStatus(id: string, status: DemoRequestLead["status"]) {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredDemoRequests();
    const updated = existing.map((item) => (item.id === id ? { ...item, status } : item));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("demo-requests-updated"));
  } catch (e) {
    console.error("Failed to update demo request status", e);
  }
}

export function deleteDemoRequest(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredDemoRequests();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("demo-requests-updated"));
  } catch (e) {
    console.error("Failed to delete demo request", e);
  }
}
