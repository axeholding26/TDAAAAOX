"use client";
import { useEffect, useRef, useState } from "react";

export function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

export function use3DTilt(maxAngle = 12) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -maxAngle, y: x * maxAngle });
  };

  const onMouseLeave = () => setTilt({ x: 0, y: 0 });

  const tiltStyle: React.CSSProperties = {
    transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(10px)`,
    transition: tilt.x === 0 ? "transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)" : "transform 0.08s linear",
    willChange: "transform",
  };

  return { tiltStyle, onMouseMove, onMouseLeave };
}

export function useMagneticButton(strength = 0.3) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setOffset({ x: (e.clientX - cx) * strength, y: (e.clientY - cy) * strength });
  };

  const onMouseLeave = () => setOffset({ x: 0, y: 0 });

  const magnetStyle: React.CSSProperties = {
    transform: `translate(${offset.x}px, ${offset.y}px)`,
    transition: offset.x === 0 ? "transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)" : "transform 0.1s linear",
    willChange: "transform",
  };

  return { magnetStyle, onMouseMove, onMouseLeave };
}
