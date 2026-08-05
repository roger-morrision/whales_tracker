"use client";

import dynamic from "next/dynamic";

const Home = dynamic(() => import("@/app/page").then((m) => m.default), {
  ssr: false,
  loading: () => <div className="min-h-screen flex items-center justify-center">Loading...</div>,
});

export default function WhalesPage() {
  return <Home />;
}