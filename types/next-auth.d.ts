import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      salespersonName?: string;
    };
  }

  interface User {
    salespersonName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    salespersonName?: string;
  }
}
