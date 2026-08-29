"use client";

import { useState, useTransition } from "react";
import { updateNameAction, updateOwnPasswordAction } from "@/lib/actions/profile";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ProfileForms({ currentName }: { currentName: string }) {
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [pendingName, startName] = useTransition();
  const [pendingPassword, startPassword] = useTransition();

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          setNameStatus(null);
          startName(async () => {
            const result = await updateNameAction(formData);
            setNameStatus(result.error || "Name updated.");
          });
        }}
        className="space-y-2"
      >
        <Label>Name</Label>
        <Input name="name" defaultValue={currentName} />
        {nameStatus && <p className="text-xs text-slate">{nameStatus}</p>}
        <Button type="submit" variant="secondary" disabled={pendingName}>
          {pendingName ? "Saving..." : "Update name"}
        </Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const formData = new FormData(form);
          setPasswordStatus(null);
          startPassword(async () => {
            const result = await updateOwnPasswordAction(formData);
            setPasswordStatus(result.error || "Password updated.");
            if (!result.error) form.reset();
          });
        }}
        className="space-y-2 border-t border-hairline pt-6"
      >
        <Label>New password</Label>
        <Input name="password" type="password" minLength={8} />
        {passwordStatus && <p className="text-xs text-slate">{passwordStatus}</p>}
        <Button type="submit" variant="secondary" disabled={pendingPassword}>
          {pendingPassword ? "Updating..." : "Update password"}
        </Button>
      </form>
    </div>
  );
}
