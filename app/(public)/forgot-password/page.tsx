import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-6 py-20">
      <h1 className="mb-2 text-2xl font-bold text-ink">Reset your password</h1>
      <p className="mb-6 text-sm text-slate">We'll email you a reset link.</p>
      <ForgotPasswordForm />
    </div>
  );
}
