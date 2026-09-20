export default function ClientsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-gray-200 rounded-xl" />
        <div className="h-9 w-32 bg-gray-100 rounded-2xl" />
      </div>
      {/* KPIs mini */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
            <div className="h-6 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      {/* Liste clients */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 bg-gray-200 rounded" />
            <div className="h-3 w-52 bg-gray-100 rounded" />
          </div>
          <div className="text-right space-y-1">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-16 bg-gray-100 rounded ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}
