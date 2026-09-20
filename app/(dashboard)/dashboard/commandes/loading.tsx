export default function CommandesLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 bg-gray-200 rounded-xl" />
        <div className="h-9 w-36 bg-gray-100 rounded-2xl" />
      </div>
      {/* Filtres */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-gray-100 rounded-full" />
        ))}
      </div>
      {/* Lignes commandes */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-48 bg-gray-100 rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-100 rounded-full" />
          <div className="h-5 w-24 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}
