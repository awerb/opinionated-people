import { randomUUID } from "crypto";

export const generateGameCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i += 1) {
    const index = Math.floor(Math.random() * alphabet.length);
    result += alphabet[index];
  }
  return result;
};

export const newId = () => randomUUID();

export const sanitizeString = (value?: string | null) => value?.trim() ?? "";
