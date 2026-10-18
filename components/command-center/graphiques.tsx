"use client";
// Point d'entrée des graphiques : Recharts n'est téléchargé que quand un graphique
// s'affiche, avec un squelette à la place pendant le chargement.
import dynamic from "next/dynamic";

const Charge = ({ h = 240 }: { h?: number }) => <div className="cc-skel w-full" style={{ height: h }} aria-hidden />;

export const Courbes = dynamic(() => import("./graphiques-impl").then((m) => m.Courbes), { ssr: false, loading: () => <Charge /> });
export const Barres = dynamic(() => import("./graphiques-impl").then((m) => m.Barres), { ssr: false, loading: () => <Charge /> });
export const Cascade = dynamic(() => import("./graphiques-impl").then((m) => m.Cascade), { ssr: false, loading: () => <Charge /> });
export const Projection = dynamic(() => import("./graphiques-impl").then((m) => m.Projection), { ssr: false, loading: () => <Charge h={220} /> });
export type { Point, Serie } from "./graphiques-impl";
