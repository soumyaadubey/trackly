import { requireUser } from "@/lib/auth";
import { initialsFor } from "@/lib/user";
import ChangePasswordForm from "./ChangePasswordForm";
import ProfileForm from "./ProfileForm";
import AvatarForm from "./AvatarForm";
import DeleteAccountForm from "./DeleteAccountForm";

export default async function ProfilePage() {
  const user = await requireUser();

  const firstName = (user.user_metadata?.first_name as string) ?? "";
  const lastName = (user.user_metadata?.last_name as string) ?? "";
  const avatarUrl = (user.user_metadata?.avatar_url as string) ?? null;

  return (
    <div className="mx-auto w-full max-w-xl px-7 py-10">
      <h1 className="font-serif mb-6 text-2xl" style={{ color: "var(--ink)" }}>
        Profile
      </h1>

      <div className="mb-5 rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <h2 className="font-serif mb-5 text-[17px]" style={{ color: "var(--ink)" }}>
          Photo
        </h2>
        <AvatarForm avatarUrl={avatarUrl} initials={initialsFor(firstName, lastName, user.email ?? "")} />
      </div>

      <div className="mb-5 rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <h2 className="font-serif mb-5 text-[17px]" style={{ color: "var(--ink)" }}>
          Name
        </h2>
        <ProfileForm firstName={firstName} lastName={lastName} />
      </div>

      <div className="mb-5 rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <div className="field-label mb-1.5">Email</div>
        <div className="text-[15px]" style={{ color: "var(--ink)" }}>
          {user.email}
        </div>
      </div>

      <div className="mb-5 rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <h2 className="font-serif mb-5 text-[17px]" style={{ color: "var(--ink)" }}>
          Change password
        </h2>
        <ChangePasswordForm />
      </div>

      <div className="rounded p-7" style={{ background: "var(--paper)", border: "1px solid var(--border)" }}>
        <h2 className="font-serif mb-2 text-[17px]" style={{ color: "var(--ink)" }}>
          Your data
        </h2>
        <p className="mb-4 text-[13px]" style={{ color: "var(--ink-muted)" }}>
          Every opportunity, course, and roadmap you&apos;ve saved, as a CSV.
          The calendar file holds your live deadlines, each with a reminder the
          day before &mdash; open it once and they land in whatever calendar you
          already use.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="/api/export" className="pill-btn-secondary inline-block text-[13px]">
            Export as CSV
          </a>
          <a href="/api/calendar" className="pill-btn-secondary inline-block text-[13px]">
            Export deadlines (.ics)
          </a>
        </div>
      </div>

      <div
        className="mt-5 rounded p-7"
        style={{ background: "var(--paper)", border: "1px solid var(--danger-border)" }}
      >
        <h2 className="font-serif mb-2 text-[17px]" style={{ color: "var(--ink)" }}>
          Delete account
        </h2>
        <p className="mb-4 text-[13px]" style={{ color: "var(--ink-muted)" }}>
          Removes your account and everything in it, permanently.
        </p>
        <DeleteAccountForm />
      </div>
    </div>
  );
}
