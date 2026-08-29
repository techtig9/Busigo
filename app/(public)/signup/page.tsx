import { SignupForm } from "@/components/auth/SignupForm";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-6 py-20">
      <h1 className="mb-2 text-2xl font-bold text-ink">Create your account</h1>
      <p className="mb-6 text-sm text-slate">Free plan, no credit card required.</p>
      <SignupForm />
    </div>
  );
}
