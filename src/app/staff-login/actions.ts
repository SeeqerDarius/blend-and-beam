"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { credentials, safeAdminNext, signInErrorMessage } from "@/lib/auth-validation";

export async function staffSignIn(form: FormData) {
  const values = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!values.success)
    redirect("/admin/login?error=Enter a valid email and password.");

  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(values.data);
  if (error)
    redirect("/admin/login?error=" + encodeURIComponent(signInErrorMessage(error)));

  const { data: member, error: membershipError } = await db.rpc("staff_membership");
  if (membershipError || member !== true) {
    await db.auth.signOut({ scope: "local" });
    redirect(
      "/admin/login?error=" +
        encodeURIComponent(
          membershipError
            ? "Staff access could not be verified. Please try again."
            : "This account has no staff access. Staff accounts are created by invitation only.",
        ),
    );
  }

  const { data: assurance, error: assuranceError } =
    await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) {
    await db.auth.signOut({ scope: "local" });
    redirect("/admin/login?error=Security verification could not be checked. Please try again.");
  }

  if (assurance?.currentLevel !== "aal2")
    redirect("/account/security?next=/admin");

  redirect(safeAdminNext(form.get("next")));
}

export async function staffSignOut() {
  const db = await createClient();
  await db.auth.signOut({ scope: "global" });
  redirect("/admin/login");
}

export async function setStaffPassword(form: FormData) {
  const password = credentials.shape.password.min(12).safeParse(form.get("password"));
  if (!password.success)
    redirect("/admin/setup-password?error=Choose a password with at least 12 characters.");

  const db = await createClient();
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError || !user)
    redirect("/admin/login?error=Open the latest staff invitation link to continue.");

  const { data: member, error: membershipError } = await db.rpc("staff_membership");
  if (membershipError || member !== true)
    redirect("/admin/login?error=Staff setup is available through an invitation only.");

  const { error } = await db.auth.updateUser({ password: password.data });
  if (error)
    redirect("/admin/setup-password?error=Password could not be saved. Please retry.");

  redirect("/account/security?next=/admin");
}
