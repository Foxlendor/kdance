import { getServerSession } from "next-auth/next"
import { redirect } from 'next/navigation';
import SpotifyPlayer from "@/components/SpotifyPlayer";
import DashboardContainer from "@/components/DashboardContainer";
import { authOptions } from "./api/auth/[...nextauth]/route";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-black relative">
      {session.user.accessToken && (
        <DashboardContainer accessToken={session.user.accessToken} />
      )}
      
      {session.user.accessToken && (
        <SpotifyPlayer accessToken={session.user.accessToken} />
      )}
    </div>
  );
}
