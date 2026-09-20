"use client";
import { useEffect, useRef } from "react";

interface Props { html: string; }

/** Injecte le script de suivi personnalisé du marchand tel quel sur SA
 *  propre vitrine — même principe que "Additional scripts" chez Shopify ou
 *  les champs équivalents WooCommerce : contenu défini par le propriétaire
 *  de la boutique authentifié, rendu uniquement sur sa propre boutique
 *  publique, jamais sur celle d'un autre marchand ni dans le dashboard.
 *  Les balises <script> insérées via innerHTML ne s'exécutent jamais dans un
 *  navigateur — on les recrée donc une par une pour qu'elles s'exécutent
 *  réellement. */
export function CustomTrackingScripts({ html }: Props) {
  const injected = useRef(false);

  useEffect(() => {
    if (!html?.trim() || injected.current || typeof window === "undefined") return;
    injected.current = true;

    const container = document.createElement("div");
    container.innerHTML = html;

    Array.from(container.childNodes).forEach(node => {
      if (node.nodeName === "SCRIPT") {
        const old = node as HTMLScriptElement;
        const script = document.createElement("script");
        Array.from(old.attributes).forEach(attr => script.setAttribute(attr.name, attr.value));
        script.textContent = old.textContent;
        document.body.appendChild(script);
      } else {
        document.body.appendChild(node.cloneNode(true));
      }
    });
  }, [html]);

  return null;
}
