import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { supabaseAdmin } from "./supabase-admin";

type VerifiedUserRow = {
  user_id: string;
  username: string;
  salesperson_name: string;
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;

        if (!username || !password) {
          return null;
        }

        const { data, error } = await supabaseAdmin.rpc(
          "verify_app_user_password",
          {
            p_username: username,
            p_password: password,
          },
        );

        if (error) {
          console.error("verify_app_user_password RPC failed", error);
          return null;
        }

        const user = Array.isArray(data)
          ? (data[0] as VerifiedUserRow | undefined)
          : (data as VerifiedUserRow | null);

        if (!user?.user_id || !user.salesperson_name) {
          return null;
        }

        return {
          id: user.user_id,
          name: user.username,
          salespersonName: user.salesperson_name,
        };
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.salespersonName) {
        token.salespersonName = user.salespersonName;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.salespersonName) {
        session.user.salespersonName = token.salespersonName as string;
      }

      return session;
    },
  },
};
