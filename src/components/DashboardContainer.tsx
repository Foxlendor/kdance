"use client";

import dynamic from 'next/dynamic';

const KdanceDashboard = dynamic(() => import("./KdanceDashboard"), {
  ssr: false,
});

export default function DashboardContainer({ accessToken }: { accessToken: string }) {
  return <KdanceDashboard accessToken={accessToken} />;
}
