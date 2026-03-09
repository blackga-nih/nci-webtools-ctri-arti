import db, { User } from "database";

import { eq } from "drizzle-orm";
import { json, Router } from "express";
import { logRequests } from "shared/middleware.js";

import { logErrors, requireRole } from "./middleware.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import modelRoutes from "./routes/model.js";
import toolRoutes from "./routes/tools.js";

const { DEV_AUTO_AUTH, TEST_API_KEY } = process.env;

const api = Router();

api.use(json({ limit: 1024 ** 3 })); // 1GB
api.use(logRequests());

// Auto-authenticate all requests in local dev (no OIDC/HTTPS needed)
if (DEV_AUTO_AUTH === "true" && TEST_API_KEY) {
  api.use(async (req, _res, next) => {
    if (!req.session?.user) {
      const user = await db.query.User.findFirst({
        where: eq(User.apiKey, TEST_API_KEY),
        with: { Role: true },
      });
      if (user) {
        req.session ||= {};
        req.session.user = user;
        req.session.userinfo = {
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
        };
      }
    }
    next();
  });
}

api.use(requireRole());
api.use(adminRoutes);
api.use(authRoutes);
api.use(conversationRoutes);
api.use(modelRoutes);
api.use(toolRoutes);
api.use(logErrors());

export default api;
