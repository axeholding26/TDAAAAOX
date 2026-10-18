// Chargement : squelettes à la place des blocs (jamais de grand spinner central).
export default function Chargement() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Chargement">
      <div className="cc-skel h-12 w-72" />
      <div className="grid gap-3 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="cc-skel h-48" />)}</div>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 12 }, (_, i) => <div key={i} className="cc-skel h-[108px]" />)}</div>
      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]"><div className="cc-skel h-72" /><div className="cc-skel h-72" /></div>
    </div>
  );
}
