export const ALL_PERMISSIONS = {
  "dashboard.view": "View dashboard and statistics",
  "visit_requests.view": "View visit requests",
  "visit_requests.create": "Create new visit requests",
  "visit_requests.approve": "Approve or reject visit requests",
  "visit_requests.check_in": "Check in visitors",
  "visit_requests.check_out": "Check out visitors",
  "visitors.view": "View visitor records",
  "visitors.manage": "Add and edit visitor records",
  "blacklist.view": "View blacklist",
  "blacklist.manage": "Add/remove from blacklist",
  "users.view": "View team members",
  "users.manage": "Invite and manage team members",
  "branches.view": "View branches",
  "branches.manage": "Create and edit branches",
  "reports.view": "View reports and analytics",
  "audit_logs.view": "View audit logs",
  "notifications.view": "View notifications",
  "notifications.manage": "Manage notification settings",
  "settings.view": "View organization settings",
  "settings.manage": "Edit organization settings",
  "roles.view": "View roles",
  "roles.manage": "Create, edit, and delete custom roles",
  "telegram.manage": "Manage Telegram bot settings",
  "public_booking.manage": "Manage public booking page settings",
} as const;

export type Permission = keyof typeof ALL_PERMISSIONS;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  visitor_manager: [
    "dashboard.view",
    "visit_requests.view", "visit_requests.create", "visit_requests.approve",
    "visitors.view", "visitors.manage",
    "blacklist.view", "blacklist.manage",
    "reports.view",
    "audit_logs.view",
    "notifications.view", "notifications.manage",
    "telegram.manage",
  ],
  receptionist: [
    "dashboard.view",
    "visit_requests.view", "visit_requests.check_in", "visit_requests.check_out",
    "visitors.view",
    "blacklist.view",
    "notifications.view",
  ],
  host_employee: [
    "dashboard.view",
    "visit_requests.view", "visit_requests.create",
    "visitors.view",
    "notifications.view",
  ],
};
