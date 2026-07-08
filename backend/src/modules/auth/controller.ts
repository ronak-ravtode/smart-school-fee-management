import { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { sendSuccess } from "@/utils/apiResponse";
import { loginUser, signupUser } from "./service";
import { LoginInput, SignupInput } from "./schemas";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;
  const { user, token } = await loginUser(email, password);

  res.cookie("jwt", token, COOKIE_OPTIONS);

  res.json(
    sendSuccess(
      { user },
      "Login successful"
    )
  );
});

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body as SignupInput;
  const { user, token } = await signupUser(name, email, password, role);

  res.cookie("jwt", token, COOKIE_OPTIONS);

  res.status(201).json(
    sendSuccess(
      { user },
      "Account created successfully"
    )
  );
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.cookie("jwt", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  res.json(sendSuccess(null, "Logged out successfully"));
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user;
  res.json(sendSuccess({ user }, "User fetched"));
});
