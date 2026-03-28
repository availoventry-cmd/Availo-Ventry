interface PendingLogin {
  userId: string;
  phone: string | null;
  email: string | null;
  expiresAt: Date;
}

export const pendingLogins = new Map<string, PendingLogin>();

setInterval(() => {
  const now = new Date();
  for (const [key, value] of pendingLogins) {
    if (value.expiresAt < now) pendingLogins.delete(key);
  }
}, 5 * 60 * 1000);
