export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Greeting skeleton */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <div className="h-6 w-48 bg-gray-200 rounded-xl mb-2" />
          <div className="h-4 w-32 bg-gray-100 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-gray-100 rounded-2xl" />
          <div className="h-8 w-36 bg-gray-200 rounded-2xl" />
        </div>
      </div>

      {/* Pulse bar skeleton */}
      <div className="h-10 w-full bg-gray-100 rounded-2xl" />

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[20px] border border-gray-100 p-5 h-28">
            <div className="flex items-start justify-between mb-3">
              <div className="h-3 w-20 bg-gray-100 rounded" />
              <div className="w-8 h-8 bg-gray-100 rounded-xl" />
            </div>
            <div className="h-6 w-24 bg-gray-200 rounded-lg mb-2" />
            <div className="h-3 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Insights skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-[16px] border border-gray-100 p-4 h-20" />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-[20px] border border-gray-100 h-72" />
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-[20px] border border-gray-100 h-36" />
          <div className="bg-white rounded-[20px] border border-gray-100 h-28" />
        </div>
      </div>
    </div>
  );
}
