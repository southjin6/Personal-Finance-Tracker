import { redirect } from "next/navigation";

import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const metadata = user.user_metadata ?? {};
  const name: string =
    metadata.full_name ?? metadata.name ?? user.email ?? "Signed in";
  const avatarUrl: string | null = metadata.avatar_url ?? null;

  return (
    <div className="flex flex-1 flex-col">
      <Header name={name} avatarUrl={avatarUrl} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
