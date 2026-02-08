import Link from "next/link";
import { BarChart3, Compass, ListChecks, LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { signOut } from "@/app/dashboard/actions";
import { createClient } from "@/lib/supabase/server";
import { getUserWorkspace } from "@/lib/workspace";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/dashboard/new-search", label: "New Search", icon: Compass },
  { href: "/dashboard/leads", label: "Leads", icon: ListChecks },
] as const;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect("/login");
  }

  const userId = user.id; // <- aquí TS ya no duda
  const workspace = await getUserWorkspace(supabase as any, userId);


  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-7xl gap-4 p-4 lg:gap-6">
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-64 flex-col rounded-xl border bg-white p-4 lg:flex">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Workspace
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {workspace.workspaceName}
            </h2>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <form action={signOut} className="mt-auto">
            <Button
              type="submit"
              variant="outline"
              className="w-full justify-start gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </form>
        </aside>

        <div className="w-full space-y-4">
          <header className="rounded-xl border bg-white p-4 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Workspace
                </p>
                <h2 className="text-lg font-semibold">
                  {workspace.workspaceName}
                </h2>
              </div>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </div>
            <nav className="mt-3 flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md border px-3 py-2 text-sm text-slate-700"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="rounded-xl border bg-white p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
