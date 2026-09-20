export default function ProduitsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="ax-skeleton h-7 w-36 rounded-xl" />
        <div className="ax-skeleton h-9 w-40 rounded-2xl" />
      </div>
      {/* Grid produits */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="ax-skeleton aspect-square" />
            <div className="p-3 space-y-2">
              <div className="ax-skeleton h-4 w-full rounded" />
              <div className="ax-skeleton h-3 w-16 rounded" />
              <div className="ax-skeleton h-5 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
