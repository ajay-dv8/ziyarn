export type BusinessType =
  | "education"
  | "health"
  | "ecommerce"
  | "hospitality"
  | "food"
  | "finance";

export type PageLabels = {
  products: string;
  productsPlural: string;
  orders: string;
  customers: string;
  bookings: string;
};

export type BusinessTypeConfig = {
  label: string;
  tagline: string;
  labels: PageLabels;
  defaultSystemPrompt: string;
  defaultTools: string[];
  showBookings: boolean;
  showProducts: boolean;
  showOrders: boolean;
};

export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeConfig> = {
  education: {
    label: "Education",
    tagline: "Schools, courses, and training",
    labels: {
      products: "Course",
      productsPlural: "Courses",
      orders: "Enrollments",
      customers: "Students",
      bookings: "Consultations",
    },
    defaultSystemPrompt:
      "You are an academic advisor and enrollment assistant for this educational institution. " +
      "Help prospective and current students with course selection, enrollment, schedules, " +
      "prerequisites, tuition, and financial aid. Be warm, encouraging, and knowledgeable. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  health: {
    label: "Health & Pharmacy",
    tagline: "Clinics, pharmacies, and wellness",
    labels: {
      products: "Service",
      productsPlural: "Services",
      orders: "Prescriptions",
      customers: "Patients",
      bookings: "Appointments",
    },
    defaultSystemPrompt:
      "You are a patient care coordinator and pharmacy assistant for this healthcare provider. " +
      "Help patients with appointment scheduling, medication inquiries, service information, " +
      "insurance questions, and general health guidance. Be compassionate, professional, and " +
      "never provide medical diagnoses. Always recommend consulting a healthcare professional. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  ecommerce: {
    label: "E-Commerce",
    tagline: "Online stores and retail",
    labels: {
      products: "Product",
      productsPlural: "Products",
      orders: "Orders",
      customers: "Customers",
      bookings: "Bookings",
    },
    defaultSystemPrompt:
      "You are a friendly sales and support assistant for this online store. " +
      "Help visitors find products, answer questions about pricing, shipping, returns, " +
      "and guide them toward making a purchase. Be concise, honest, and helpful. " +
      "Never invent product details you are unsure about. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "create_payment",
      "sell_product",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: false,
    showProducts: true,
    showOrders: true,
  },
  hospitality: {
    label: "Hotels & Hospitality",
    tagline: "Hotels, resorts, and travel",
    labels: {
      products: "Package",
      productsPlural: "Packages",
      orders: "Reservations",
      customers: "Guests",
      bookings: "Bookings",
    },
    defaultSystemPrompt:
      "You are a front desk concierge for this hospitality business. " +
      "Help guests with room availability, reservations, amenities, local recommendations, " +
      "check-in/check-out, and special requests. Be warm, welcoming, and attentive. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "sell_product",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  food: {
    label: "Food & Restaurants",
    tagline: "Restaurants, catering, and delivery",
    labels: {
      products: "Menu Item",
      productsPlural: "Menu Items",
      orders: "Orders",
      customers: "Customers",
      bookings: "Reservations",
    },
    defaultSystemPrompt:
      "You are a helpful restaurant assistant for this food business. " +
      "Help customers with menu inquiries, orders, reservations, catering requests, " +
      "dietary restrictions, delivery options, and special promotions. Be friendly, " +
      "knowledgeable about the menu, and patient with dietary questions. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "sell_product",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
  finance: {
    label: "Banking & Finance",
    tagline: "Banks, fintech, and advisory",
    labels: {
      products: "Product",
      productsPlural: "Products",
      orders: "Applications",
      customers: "Clients",
      bookings: "Consultations",
    },
    defaultSystemPrompt:
      "You are a financial services assistant for this institution. " +
      "Help customers with account inquiries, product information, loan applications, " +
      "investment options, interest rates, and general financial guidance. Be professional, " +
      "precise, and security-conscious. Never share account-specific information without " +
      "proper authentication. Never provide personalized financial advice. " +
      "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
    defaultTools: [
      "capture_email",
      "book_appointment",
      "create_payment",
      "answer_knowledge",
      "escalate",
    ],
    showBookings: true,
    showProducts: true,
    showOrders: true,
  },
};

/** Generic fallback when no business type is set. */
export const GENERIC_CONFIG: BusinessTypeConfig = {
  label: "Generic",
  tagline: "Sales and support assistant",
  labels: {
    products: "Product",
    productsPlural: "Products",
    orders: "Orders",
    customers: "Customers",
    bookings: "Bookings",
  },
  defaultSystemPrompt:
    "You are a friendly sales and support assistant for this business. " +
    "Help visitors with their questions, qualify their interest, and move them " +
    "toward booking a call or buying. Be concise, honest and helpful. " +
    "Never invent company facts you are unsure about. " +
    "If a visitor asks for a human, is frustrated, or the request is out of scope, escalate.",
  defaultTools: [
    "capture_email",
    "book_appointment",
    "create_payment",
    "sell_product",
    "answer_knowledge",
    "escalate",
  ],
  showBookings: true,
  showProducts: true,
  showOrders: true,
};

/** Returns config for the given type, or generic defaults if null/undefined. */
export function getBusinessTypeConfig(
  type: BusinessType | null | undefined,
): BusinessTypeConfig {
  return (type && BUSINESS_TYPES[type]) ?? GENERIC_CONFIG;
}
