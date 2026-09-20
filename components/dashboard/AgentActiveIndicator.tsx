import { Bot } from "lucide-react";

export function AgentActiveIndicator({ label = "Agent IA actif sur ce module" }: { label?: string }) {
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#EDA900]/10 border border-[#EDA900]/25 text-[#B4740A] flex-shrink-0"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16A34A] opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#16A34A]" />
      </span>
      <Bot size={11} strokeWidth={2} />
    </span>
  );
}
