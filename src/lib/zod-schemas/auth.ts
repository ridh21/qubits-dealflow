import { z } from "zod";

export const LoginInput = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const SignupInput = z.object({
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid work email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export const PortalLoginInput = z.object({
  email: z.string().email("Enter the email your quotes were sent to."),
});

export type LoginInput = z.infer<typeof LoginInput>;
export type SignupInput = z.infer<typeof SignupInput>;
