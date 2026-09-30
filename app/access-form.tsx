'use client';

import { type FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, LockKeyhole } from 'lucide-react';

export default function AccessForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setError(data.error || 'Unable to continue.'); setPending(false); return; }
    router.refresh();
  }

  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_12%_0%,#efffa7_0,transparent_28%),radial-gradient(circle_at_88%_85%,#fff0a3_0,transparent_28%),linear-gradient(145deg,#fbfaf5,#efefe7)] px-5 py-10 text-[#171914]">
    <section className="w-full max-w-md rounded-[32px] border border-white/80 bg-white/75 p-8 shadow-[0_28px_90px_rgba(36,43,30,.16)] backdrop-blur-2xl">
      <div className="flex items-center gap-3"><span className="grid size-12 place-items-center overflow-hidden rounded-full bg-[#78d11f] shadow-[0_0_0_5px_rgba(213,255,61,.22)]"><img src="/coverdesk-logo.png" alt="Coverdesk logo" className="size-full object-cover" /></span><div><p className="text-xl font-extrabold tracking-tight">Coverdesk</p><p className="text-xs text-black/45">Cover and complete book review</p></div></div>
      <div className="mt-10"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#66796d]">Protected workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Enter the workspace password</h1><p className="mt-2 text-sm leading-6 text-black/50">Your password opens either cover review or complete book review.</p></div>
      <form onSubmit={submit} className="mt-8">
        <label className="block text-sm font-semibold">Password<span className="relative mt-2 block"><LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35" /><input autoFocus value={password} onChange={(event) => setPassword(event.target.value)} type={show ? 'text' : 'password'} required className="h-12 w-full rounded-xl border border-black/10 bg-white pl-10 pr-11 text-sm outline-none focus:border-[#91b52a] focus:ring-4 focus:ring-[#dfff74]/35" placeholder="Enter password" /><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-black/40" aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
        {error && <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
        <button disabled={pending} className="mt-5 h-12 w-full rounded-xl bg-[#1b2a21] font-semibold text-white shadow-lg disabled:opacity-60">{pending ? 'Checking…' : 'Open review workspace'}</button>
      </form>
    </section>
  </main>;
}
