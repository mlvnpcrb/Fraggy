import type { SupabaseClient } from "@supabase/supabase-js";
export async function signOutDevice(client: SupabaseClient) {
  return client.auth.signOut({ scope: "local" });
}
export type AccountLease = { userId: string; generation: number };
export class AccountScope {
  private userId: string | null = null;
  private generation = 0;
  set(userId: string | null) {
    if (userId !== this.userId) {
      this.userId = userId;
      this.generation++;
    }
  }
  invalidate() {
    this.generation++;
  }
  capture(): AccountLease {
    if (!this.userId) throw Error("Sign in to Fraggy.");
    return { userId: this.userId, generation: this.generation };
  }
  valid(lease: AccountLease) {
    return lease.userId === this.userId && lease.generation === this.generation;
  }
}
