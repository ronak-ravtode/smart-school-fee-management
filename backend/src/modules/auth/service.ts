import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "@/models";
import { ValidationError, ConflictError } from "@/lib/errors";

const JWT_SECRET = process.env.JWT_SECRET || "smartschool-jwt-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "CASHIER";
}

export async function loginUser(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const user = await User.findOne({ email });
  if (!user) throw new ValidationError("Invalid email or password");

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) throw new ValidationError("Invalid email or password");

  const authUser: AuthUser = { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
  const token = jwt.sign(authUser, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { user: authUser, token };
}

export async function signupUser(name: string, email: string, password: string, role: "ADMIN" | "CASHIER" = "CASHIER"): Promise<{ user: AuthUser; token: string }> {
  const existing = await User.findOne({ email });
  if (existing) throw new ConflictError("A user with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role });

  const authUser: AuthUser = { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
  const token = jwt.sign(authUser, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  return { user: authUser, token };
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
