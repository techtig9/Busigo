import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "Set a new password" };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center px-6 py-20">
      <h1 className="mb-6 text-2xl font-bold text-ink">Set a new password</h1>
      <ResetPasswordForm />
    </div>
  );
}
