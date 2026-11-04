"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/account/auth-form";
import { PistachioMark } from "@/components/ui/logo";

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  return (
    <div className="gutter mx-auto max-w-md pb-10 pt-10">
      <PistachioMark className="size-14" />
      <h1 className="mt-4 text-4xl font-extrabold">Welcome to Pistachio Guide</h1>
      <p className="mb-6 mt-2 text-ink-soft">Save places, set your budget and get picks that suit you.</p>
      <AuthForm initialMode={params.get("mode") === "signup" ? "signup" : "signin"} onDone={() => router.push(params.get("next") ?? "/profile")} />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
