import { Card } from "@/components/ui/Card";
import { AcceptInviteButton } from "./AcceptInviteButton";

export const dynamic = "force-dynamic";

export default function AcceptInvitePage({ params }: { params: { token: string } }) {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-bold text-ink">Join workspace</h1>
        <p className="mt-2 text-sm text-slate">
          You've been invited to join a BusiGo workspace. Accepting will make it available in your workspace
          switcher with the role the invite was sent for.
        </p>
        <AcceptInviteButton token={params.token} />
      </Card>
    </div>
  );
}
