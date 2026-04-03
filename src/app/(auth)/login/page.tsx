import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />

      <div className="md3-card w-full max-w-[440px] p-10 bg-surface/80 backdrop-blur-xl border border-outline-variant/20 shadow-elevation-3 z-10 relative">
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/20">
             <span className="material-symbols-outlined text-surface text-[32px] icon-filled">monitoring</span>
          </div>
          <h1 className="text-headline-sm font-black text-on-surface tracking-tighter">OPS CONTROL</h1>
          <p className="text-label-md font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">Sellers Intelligence Hub</p>
        </div>

        <form className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60 ml-1">E-mail Corporativo</label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30 group-focus-within:text-primary transition-colors text-[20px]">alternate_email</span>
              <input 
                className="w-full bg-surface-container-low border border-outline-variant/30 px-12 py-3.5 rounded-xl text-body-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-on-surface-variant/20 font-medium" 
                type="email" 
                placeholder="exemplo@empresa.com" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant/60">Senha de Acesso</label>
              <button type="button" className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline transition-all">Recuperar</button>
            </div>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30 group-focus-within:text-primary transition-colors text-[20px]">lock_open</span>
              <input 
                className="w-full bg-surface-container-low border border-outline-variant/30 px-12 py-3.5 rounded-xl text-body-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-on-surface-variant/20 font-medium" 
                type="password" 
                placeholder="••••••••" 
              />
            </div>
          </div>

          <div className="pt-4">
             <Link href="/dashboard" className="btn-primary w-full h-12 rounded-xl text-label-md font-black uppercase tracking-[0.2em] shadow-elevation-2 flex items-center justify-center gap-2 group">
                Acessar Dashboard
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
             </Link>
          </div>
        </form>

        <div className="mt-10 pt-8 border-t border-outline-variant/10 text-center">
           <p className="text-[10px] font-bold text-on-surface-variant/30 uppercase tracking-widest leading-relaxed">
             Software de gestão de alta performance para Sellers na Amazon.<br/>
             <span className="text-primary/40 font-black">© 2026 Ops Control · Tier 1 B2B Solution</span>
           </p>
        </div>
      </div>
    </div>
  );
}
