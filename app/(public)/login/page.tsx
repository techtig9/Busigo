import { LoginForm } from "@/components/auth/LoginForm";
import Link from "next/link";

export const metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: { searchParams: { verify?: string } }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-6 py-20">
      <h1 className="mb-6 text-2xl font-bold text-ink">Log in</h1>
      <LoginForm justVerified={searchParams.verify === "1"} />
    </div>
  );
}
