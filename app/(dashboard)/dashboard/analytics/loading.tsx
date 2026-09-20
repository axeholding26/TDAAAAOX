export default function AnalyticsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 bg-gray-200 rounded-xl" />
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-gray-100 rounded-xl" />
          <div className="h-8 w-20 bg-gray-100 rounded-xl" />
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-28">
            <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
            <div className="h-6 w-24 bg-gray-200 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      {/* Chart grand */}
      <div className="bg-white rounded-2xl border border-gray-100 h-80" />
      {/* Charts secondaires */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 h-56" />
        <div className="bg-white rounded-2xl border border-gray-100 h-56" />
      </div>
    </div>
  );
}
