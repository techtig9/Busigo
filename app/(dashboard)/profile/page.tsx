import { createServerSupabase } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { ProfileForms } from "./ProfileForms";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("users").select("name, email, role").eq("id", user.id).single();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-ink">Profile</h1>
      <Card>
        <p className="text-xs uppercase tracking-wide text-slate">Email</p>
        <p className="mt-1 text-sm text-ink">{profile?.email}</p>
        {profile?.role === "admin" && <p className="mt-1 text-xs text-signal">Admin account</p>}
      </Card>
      <Card>
        <ProfileForms currentName={profile?.name || ""} />
      </Card>
    </div>
  );
}
