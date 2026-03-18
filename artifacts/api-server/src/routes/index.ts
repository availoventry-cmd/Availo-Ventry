import { Router } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import organizationsRouter from "./organizations.js";
import branchesRouter from "./branches.js";
import usersRouter from "./users.js";
import invitationsRouter from "./invitations.js";
import visitorsRouter from "./visitors.js";
import visitRequestsRouter from "./visitRequests.js";
import blacklistRouter from "./blacklist.js";
import dashboardRouter from "./dashboard.js";
import auditLogsRouter from "./auditLogs.js";
import reportsRouter from "./reports.js";
import publicRouter from "./publicRoutes.js";
import notificationsRouter from "./notifications.js";
import verificationRouter from "./verification.js";
import telegramRouter from "./telegram.js";

const router = Router();

router.use("/", healthRouter);
router.use("/auth", authRouter);
router.use("/organizations", organizationsRouter);
router.use("/organizations/:orgId/branches", branchesRouter);
router.use("/organizations/:orgId/users", usersRouter);
router.use("/organizations/:orgId/invitations", invitationsRouter);
router.use("/organizations/:orgId/visitors", visitorsRouter);
router.use("/organizations/:orgId/visit-requests", visitRequestsRouter);
router.use("/organizations/:orgId/blacklist", blacklistRouter);
router.use("/organizations/:orgId/audit-logs", auditLogsRouter);
router.use("/organizations/:orgId/reports", reportsRouter);
router.use("/dashboard", dashboardRouter);
router.use("/public", publicRouter);
router.use("/notifications", notificationsRouter);
router.use("/verification", verificationRouter);
router.use("/telegram", telegramRouter);

export default router;
