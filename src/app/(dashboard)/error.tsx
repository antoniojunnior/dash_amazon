'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro para monitoramento (Cloudflare logs capturarão isso)
    console.error('[Dashboard Error Boundary]', error);
  }, [error]);

  const isConfigError = error.message.includes('not configured') || error.message.includes('missing');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-surface-container-low rounded-3xl border border-outline-variant/10 shadow-sm">
      <div className="w-20 h-20 rounded-full bg-error-container text-on-error-container flex items-center justify-center mb-6 shadow-sm">
        <span className="material-symbols-outlined text-[40px] icon-filled">error</span>
      </div>
      
      <h2 className="text-display-small font-black text-on-surface mb-2 tracking-tighter">
        Ops! Algo deu errado.
      </h2>
      
      <p className="text-body-large text-on-surface-variant max-w-md mb-8">
        {isConfigError 
          ? 'Parece que o ambiente ainda não foi totalmente configurado. Verifique as variáveis de ambiente no dashboard do Cloudflare.' 
          : 'Ocorreu um erro inesperado ao processar os dados operacionais.'}
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <button
          onClick={() => reset()}
          className="btn-primary !h-12 !px-8 uppercase tracking-widest font-black text-[11px]"
        >
          Tentar Novamente
        </button>
        
        <a
          href="/"
          className="btn-tonal !h-12 !px-8 uppercase tracking-widest font-black text-[11px]"
        >
          Voltar para Home
        </a>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div className="mt-12 p-4 bg-error-container/20 rounded-xl text-left border border-error/10 max-w-2xl overflow-auto">
          <p className="text-[10px] font-black uppercase text-error mb-2 tracking-widest">Debug Info (Somente Dev)</p>
          <pre className="text-[11px] text-on-error-container mono break-all whitespace-pre-wrap">
            {error.message}
            {error.digest && `\nDigest: ${error.digest}`}
          </pre>
        </div>
      )}
    </div>
  );
}
