"use client";

import OctaneOrderCard from "../providers/components/OctaneOrderCard";

export default function OctanePage() {
  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg sm:text-xl font-semibold flex items-center gap-2 leading-tight">
          <span className="material-symbols-outlined text-orange-500">rocket_launch</span>
          Octane Order
        </h1>
        <p className="text-sm text-text-muted">
          Urutan fallback provider untuk semua model <code>ot/</code> + routing per model.
        </p>
      </div>
      <OctaneOrderCard />
    </div>
  );
}
