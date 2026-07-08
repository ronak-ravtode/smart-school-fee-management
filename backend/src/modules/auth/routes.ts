import { Router } from "express";
import { validate } from "@/middleware/validate";
import { protectRoute } from "@/middleware/protectRoute";
import { LoginSchema, SignupSchema } from "./schemas";
import { login, signup, logout, getMe } from "./controller";

const router = Router();

router.post("/login", validate(LoginSchema, "body"), login);
router.post("/signup", validate(SignupSchema, "body"), signup);
router.post("/logout", logout);
router.get("/me", protectRoute, getMe);

export { router as authModuleRoutes };
