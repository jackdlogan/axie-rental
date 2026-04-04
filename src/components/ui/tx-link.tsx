"use client";

interface TxLinkProps {
  hash: string;
  label?: string;
}

export function TxLink({ hash, label }: TxLinkProps) {
  const short = label ?? `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  return (
    <a
      href={`https://app.roninchain.com/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs text-primary hover:underline inline-flex items-center gap-1"
    >
      {short}
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
    </a>
  );
}
