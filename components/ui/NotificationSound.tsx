"use client";
import { useEffect } from "react";

// Son unique des notifications de la plateforme (toasts, nouvelle commande,
// prises de parole d'AXIA) : son de base + « cha-ching » d'argent à la fin.
export function jouerSonNotification() {
  new Audio("/son-notification.mp3").play().catch(() => { /* lecture bloquée ou audio indisponible */ });
}

export function NotificationSound() {
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node instanceof HTMLElement &&
            (node.hasAttribute("data-sonner-toast") ||
              node.querySelector("[data-sonner-toast]"))
          ) {
            jouerSonNotification();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
