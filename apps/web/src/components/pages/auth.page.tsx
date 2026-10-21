'use client';

import AuthForm from '@/components/auth/auth.form';

export default function AuthPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6 lg:px-8 font-sans">
      {/* Background radial glow */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: 'radial-gradient(ellipse at top right, rgba(168, 85, 247, 0.1), transparent 50%), radial-gradient(ellipse at bottom left, rgba(59, 130, 246, 0.1), transparent 50%)'
        }}
      />
      
      {/* Grid background pattern */}
      <div className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <div className="w-full max-w-md space-y-8 flex flex-col items-center">
        <div className="flex flex-col items-center text-center">
          {/* Brand Icon wrapper with pulsing background blur */}
          <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-card border border-border/40 shadow-xl/10 animate-fade-in">
            <div className="absolute inset-0 -m-3 bg-purple-500/15 blur-xl rounded-full animate-pulse" />
            <img src="/apple-touch-icon.png" alt="TeleGenie" className="relative h-12 w-12 object-contain" />
          </div>
          
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl bg-gradient-to-r from-[#41D1FF] to-[#BD34FE] bg-clip-text text-transparent">
            TeleGenie
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground max-w-sm">
            Your premium, agent-powered portal connected directly to Telegram
          </p>
        </div>

        <AuthForm />
      </div>

      {/* Footer support text positioned absolutely at the bottom to ensure vertical centering of content */}
      <footer className="absolute bottom-6 text-center text-xs text-muted-foreground/60">
        <p>© {new Date().getFullYear()} TeleGenie. Secure Telegram session authentication.</p>
      </footer>
    </div>
  );
}
