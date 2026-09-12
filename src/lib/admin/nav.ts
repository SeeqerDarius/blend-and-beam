export type PermissionKey =
  | "admin.access"
  | "products.manage"
  | "inventory.manage"
  | "orders.manage"
  | "customers.read"
  | "payments.read"
  | "discounts.manage"
  | "reviews.manage"
  | "content.manage"
  | "reports.read"
  | "staff.manage"
  | "settings.manage"
  | "audit.read";

export type AdminNavItem = {
  label: string;
  href: string;
  permission: PermissionKey;
};

export const adminNav: AdminNavItem[] = [
  { label: "Overview", href: "/admin", permission: "admin.access" },
  { label: "Products", href: "/admin/products", permission: "products.manage" },
  { label: "Categories", href: "/admin/categories", permission: "products.manage" },
  { label: "Inventory", href: "/admin/inventory", permission: "inventory.manage" },
  { label: "Orders", href: "/admin/orders", permission: "orders.manage" },
  { label: "Customers", href: "/admin/customers", permission: "customers.read" },
  { label: "Payments", href: "/admin/payments", permission: "payments.read" },
  { label: "Discounts", href: "/admin/discounts", permission: "discounts.manage" },
  { label: "Reviews", href: "/admin/reviews", permission: "reviews.manage" },
  { label: "Content", href: "/admin/content", permission: "content.manage" },
  { label: "Reports", href: "/admin/reports", permission: "reports.read" },
  { label: "Staff", href: "/admin/staff", permission: "staff.manage" },
  { label: "Settings", href: "/admin/settings", permission: "settings.manage" },
  { label: "Audit logs", href: "/admin/audit-logs", permission: "audit.read" },
];
