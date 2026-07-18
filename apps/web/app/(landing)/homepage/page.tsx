import type { Metadata } from "next";
import { AtbLanding } from "@/features/landing/components/atb-landing";

export const metadata: Metadata = {
  title: "Homepage",
  description:
    "auto-tobe — open-source platform that turns coding agents into real teammates. Assign tasks, track progress, compound skills.",
  openGraph: {
    title: "auto-tobe — Project Management for Human + Agent Teams",
    description:
      "Manage your human + agent workforce in one place.",
    url: "/homepage",
  },
  alternates: {
    canonical: "/homepage",
  },
};

export default function HomepagePage() {
  return <AtbLanding />;
}
