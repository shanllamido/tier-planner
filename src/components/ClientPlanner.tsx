"use client";

import dynamic from "next/dynamic";

// The board restores saved work from localStorage, so it only renders in the browser.
export const ClientPlanner = dynamic(() => import("./Planner").then((m) => m.Planner), {
  ssr: false,
  loading: () => <div className="mx-auto h-40 max-w-[1440px] px-4 sm:px-6"><div className="h-full animate-pulse rounded-2xl bg-white" /></div>,
});
