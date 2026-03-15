'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black">
      <img className="w-52 mb-5" src="https://links.papareact.com/9xl" alt="Spotify Logo" />
      
      {error && (
        <div className="mb-4 text-red-500 bg-red-100 p-3 rounded text-center">
          <p className="font-bold">Authentication Error</p>
          <p>There was a problem logging in. ({error})</p>
          <p className="text-sm mt-1">Please ensure your Spotify Developer credentials are correct and try again.</p>
        </div>
      )}

      <button
        className="bg-[#18D860] text-white p-5 rounded-full hover:bg-green-500 transition"
        onClick={() => signIn('spotify', { callbackUrl: '/' })}
      >
        Login with Spotify
      </button>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
