"use client";

import { Suspense, useRef, useState, useEffect, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Environment, useGLTF, useAnimations } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// Dépose ton export Meshy (format GLB) ici pour qu'il remplace automatiquement
// le placeholder ci-dessous — aucun changement de code nécessaire.
const MODEL_URL = "/models/axia.glb";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// ── Parallax souris : incline doucement la scène vers le curseur ───────────
function PointerParallax({ children, strength = 0.35 }: { children: ReactNode; strength?: number }) {
  const group = useRef<THREE.Group>(null);
  const reduced = usePrefersReducedMotion();

  useFrame((state) => {
    if (!group.current || reduced) return;
    const targetX = state.pointer.y * strength;
    const targetY = state.pointer.x * strength;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 0.06);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.06);
  });

  return <group ref={group}>{children}</group>;
}

// ── Placeholder — orbe organique doré/navy, le temps que le vrai modèle
//    Meshy soit exporté. Distordu façon "intelligence liquide", cohérent
//    avec l'identité Axso (accent doré #F5A623, noir #111111). ────────────
function PlaceholderOrb() {
  const mesh = useRef<THREE.Mesh>(null);
  const reduced = usePrefersReducedMotion();

  useFrame((_, delta) => {
    if (mesh.current && !reduced) mesh.current.rotation.y += delta * 0.15;
  });

  return (
    <Float speed={reduced ? 0 : 1.4} rotationIntensity={reduced ? 0 : 0.4} floatIntensity={reduced ? 0 : 0.6}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.3, 12]} />
        <MeshDistortMaterial
          color="#F5A623"
          emissive="#111111"
          emissiveIntensity={0.25}
          metalness={0.85}
          roughness={0.15}
          distort={0.35}
          speed={reduced ? 0 : 1.8}
        />
      </mesh>
      {/* Anneau navy fin, décoratif — évoque une interface tech */}
      <mesh rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[1.9, 0.015, 16, 100]} />
        <meshStandardMaterial color="#111111" emissive="#F5A623" emissiveIntensity={0.4} metalness={0.9} roughness={0.3} />
      </mesh>
    </Float>
  );
}

// ── Modèle réel — chargé depuis /public/models/axia.glb une fois exporté
//    de Meshy. Joue le clip d'animation embarqué s'il y en a un (Meshy
//    exporte souvent une rotation/idle animation baked-in). ────────────────
function GltfModel({ url }: { url: string }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions } = useAnimations(animations, group);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const first = Object.values(actions)[0];
    first?.reset().play();
    return () => { first?.stop(); };
  }, [actions, reduced]);

  return (
    <Float speed={reduced ? 0 : 1.2} rotationIntensity={reduced ? 0 : 0.25} floatIntensity={reduced ? 0 : 0.5}>
      <group ref={group}>
        <primitive object={scene} scale={1.4} />
      </group>
    </Float>
  );
}

// ── Filet de sécurité : si le GLB n'existe pas encore (404) ou échoue au
//    chargement, on retombe sur le placeholder sans casser la page. ────────
class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Scene() {
  const { gl } = useThree();
  const [modelReady, setModelReady] = useState(false);
  useEffect(() => { gl.setPixelRatio(Math.min(window.devicePixelRatio, 2)); }, [gl]);
  // Le GLB (export Meshy) peut ne pas encore exister. On sonde sa présence
  // avant de monter <GltfModel/> : sinon useGLTF déclenche un fetch 404 dont
  // le rejet échappe au ModelErrorBoundary (erreur non capturée côté client).
  // Dès que /models/axia.glb est déposé, il est détecté et chargé automatiquement.
  useEffect(() => {
    let cancelled = false;
    fetch(MODEL_URL, { method: "HEAD" })
      .then((res) => { if (!cancelled && res.ok) setModelReady(true); })
      .catch(() => { /* fichier absent ou non interrogeable : on garde l'orbe */ });
    return () => { cancelled = true; };
  }, []);
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 5, 3]} intensity={1.4} color="#FFE3B0" />
      <pointLight position={[-4, -2, -3]} intensity={0.8} color="#F5A623" />
      <Environment preset="city" environmentIntensity={0.4} />
      <PointerParallax>
        <Suspense fallback={<PlaceholderOrb />}>
          {modelReady ? (
            <ModelErrorBoundary fallback={<PlaceholderOrb />}>
              <GltfModel url={MODEL_URL} />
            </ModelErrorBoundary>
          ) : (
            <PlaceholderOrb />
          )}
        </Suspense>
      </PointerParallax>
      <EffectComposer>
        <Bloom intensity={0.6} luminanceThreshold={0.25} luminanceSmoothing={0.9} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function Axia3D({ className }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className={className} style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Halo statique affiché pendant l'hydratation/chargement — évite un
          flash de contenu vide et donne une continuité visuelle avec le rendu 3D. */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, borderRadius: "9999px",
          background: "radial-gradient(circle at 50% 45%, rgba(245,166,35,0.35), rgba(27,42,74,0.15) 55%, transparent 75%)",
          opacity: mounted ? 0 : 1, transition: "opacity 0.6s ease",
          pointerEvents: "none",
        }}
      />
      {mounted && (
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 40 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <Scene />
        </Canvas>
      )}
    </div>
  );
}
