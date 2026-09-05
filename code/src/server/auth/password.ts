import bcrypt from "bcryptjs";

const ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
