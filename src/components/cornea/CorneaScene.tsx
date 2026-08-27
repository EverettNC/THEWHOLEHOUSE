import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { buildCorneaGeometry, buildCutFace } from "@/lib/cornea/geometry";
import { traceMeridianRays, WORLDS } from "@/lib/cornea/optics";
import { makeSiliconTexture, makeTableTexture } from "@/lib/cornea/textures";
import { useCornea, useCorneaParams, useOptics } from "@/lib/cornea/store";
import { liveSourceReady, useLiveFeed } from "@/lib/cornea/live-feed";

function DarkEnv() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color("#0c0d10");
    envScene.add(new THREE.HemisphereLight("#8b9196", "#09090b", 0.2));
    const wall = new THREE.Mesh(
      new THREE.SphereGeometry(10, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#15171b", side: THREE.BackSide }),
    );
    envScene.add(wall);
    let rt: THREE.WebGLRenderTarget | null = null;
    try {
      rt = pmrem.fromScene(envScene, 0.03);
      scene.environment = rt.texture;
    } catch {
      scene.environment = null;
    }
    scene.background = new THREE.Color("#09090b");
    if ("environmentIntensity" in scene) {
      (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.12;
    }
    wall.geometry.dispose();
    (wall.material as THREE.Material).dispose();
    return () => {
      rt?.dispose();
      pmrem.dispose();
      scene.environment = null;
    };
  }, [gl, scene]);
  return null;
}

function WorldField() {
  const worldId = useCornea((s) => s.worldId);
  const demoWorld = useCornea((s) => s.demoWorld);
  const live = useLiveFeed();
  const src = WORLDS.find((w) => w.id === worldId)?.src ?? WORLDS[0].src;
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useFrame(() => {
    if (tex) tex.needsUpdate = true;
  });

  useEffect(() => {
    const source = liveSourceReady(live);
    if (source instanceof HTMLVideoElement) {
      const vt = new THREE.VideoTexture(source);
      vt.colorSpace = THREE.SRGBColorSpace;
      vt.minFilter = THREE.LinearFilter;
      vt.magFilter = THREE.LinearFilter;
      setTex(vt);
      return () => {
        vt.dispose();
        setTex(null);
      };
    }
    if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
      const t = new THREE.Texture(source);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      setTex(t);
      return () => {
        t.dispose();
        setTex(null);
      };
    }
    if (!demoWorld) {
      setTex(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    const texture = loader.load(src, () => {
      if (cancelled) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      setTex(texture);
    });
    return () => {
      cancelled = true;
      texture.dispose();
      setTex(null);
    };
  }, [live.status, live.kind, live.still, live.video, demoWorld, src]);

  if (!tex) {
    return (
      <mesh position={[0, 2.2, -26]}>
        <planeGeometry args={[42, 24]} />
        <meshBasicMaterial color="#141518" />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 2.2, -26]}>
      <planeGeometry args={[42, 24]} />
      <meshBasicMaterial map={tex} color="#c4c8ca" />
    </mesh>
  );
}

function CorneaOrgan() {
  const p = useCorneaParams();
  const cut = useCornea((s) => s.crossSection);
  const optics = useOptics();
  const geo = useMemo(() => buildCorneaGeometry(p, cut), [p, cut]);
  const cutGeo = useMemo(() => (cut ? buildCutFace(p) : null), [cut, p]);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => () => cutGeo?.dispose(), [cutGeo]);

  const roughness = 0.14 + (1 - p.tearFilm) * 0.35 + optics.scatter * 0.28;
  const transmission = Math.min(0.78, Math.max(0.42, optics.transmission * 0.8));
  const atten = optics.scatter > 0.35 ? "#a8ada9" : "#c5cdc8";

  return (
    <group scale={1.15}>
      <mesh geometry={geo} castShadow>
        <meshPhysicalMaterial
          color="#cfd8d4"
          metalness={0}
          roughness={roughness}
          transmission={transmission}
          thickness={0.9}
          ior={p.ior}
          attenuationColor={atten}
          attenuationDistance={1.6}
          clearcoat={0.2 + p.tearFilm * 0.35}
          clearcoatRoughness={0.12 + (1 - p.tearFilm) * 0.4}
          transparent
          opacity={1}
          envMapIntensity={0.18}
          sheen={0.22}
          sheenRoughness={0.5}
          sheenColor="#c5d0d4"
        />
      </mesh>
      {cutGeo ? (
        <mesh geometry={cutGeo}>
          <meshStandardMaterial
            vertexColors
            roughness={0.5}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function Rays() {
  const p = useCorneaParams();
  const show = useCornea((s) => s.showRays);
  const optics = useOptics();
  const heights = useMemo(() => {
    const zone = Math.min(p.pupilMm, p.opticalZoneMm) / 2;
    const n = 7;
    const hs: number[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      hs.push(-zone + t * 2 * zone);
    }
    return hs;
  }, [p.pupilMm, p.opticalZoneMm]);

  const paths = useMemo(
    () => traceMeridianRays(p, heights, -18, p.siliconMm + 0.2),
    [p, heights],
  );

  if (!show) return null;

  const focused = Math.abs(optics.defocusD) < 0.45;
  const color = focused ? "#c5d0d4" : "#8b9196";

  return (
    <group>
      {paths.map((ray, i) => (
        <Line
          key={`h-${i}`}
          points={ray.points.map(([h, z]) => [h, 0, z] as [number, number, number])}
          color={color}
          lineWidth={1.2}
          transparent
          opacity={0.75}
        />
      ))}
      {paths.map((ray, i) => (
        <Line
          key={`v-${i}`}
          points={ray.points.map(([h, z]) => [0, h, z] as [number, number, number])}
          color={color}
          lineWidth={0.85}
          transparent
          opacity={0.22}
        />
      ))}
    </group>
  );
}

function SiliconDie() {
  const z = useCornea((s) => s.siliconMm);
  const tex = useMemo(() => makeSiliconTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, 0, z]}>
      <mesh receiveShadow>
        <boxGeometry args={[12.4, 9.6, 0.28]} />
        <meshStandardMaterial map={tex} roughness={0.38} metalness={0.42} color="#aeb6b2" />
      </mesh>
      <mesh position={[0, 0, -0.28]}>
        <boxGeometry args={[14, 11, 0.4]} />
        <meshStandardMaterial color="#121214" roughness={0.8} metalness={0.06} />
      </mesh>
    </group>
  );
}

function Bench() {
  const tex = useMemo(() => makeTableTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -7.2, 10]} receiveShadow>
      <planeGeometry args={[70, 70]} />
      <meshStandardMaterial map={tex} roughness={0.95} metalness={0.03} color="#6e6e72" />
    </mesh>
  );
}

function Iris() {
  const pupil = useCornea((s) => s.pupilMm);
  const inner = Math.max(0.6, pupil / 2);
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.absarc(0, 0, 5.4, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    s.holes.push(hole);
    return s;
  }, [inner]);
  return (
    <mesh position={[0, 0, 0.7]}>
      <shapeGeometry args={[shape, 64]} />
      <meshStandardMaterial color="#101114" roughness={0.92} metalness={0} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight position={[-8, 6, -10]} intensity={0.22} color="#d5dadd" />
      <spotLight
        position={[10, 3.5, 2]}
        angle={0.12}
        penumbra={0.7}
        intensity={3.2}
        color="#dfe6e8"
        distance={32}
      />
      <pointLight position={[0, 2, 18]} intensity={0.6} color="#c5d0d4" />
    </>
  );
}

function SceneBody() {
  const worldId = useCornea((s) => s.worldId);
  return (
    <>
      <DarkEnv />
      <Lights />
      <WorldField key={worldId} />
      <CorneaOrgan />
      <Iris />
      <Rays />
      <SiliconDie />
      <Bench />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={8}
        maxDistance={42}
        target={[0, 0.3, 8]}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}

export function CorneaScene() {
  return (
    <Canvas
      className="absolute inset-0 touch-none"
      style={{ width: "100%", height: "100%", display: "block" }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ position: [12.5, 5.2, -8.5], fov: 30, near: 0.1, far: 220 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.58;
        gl.setClearColor("#09090b");
      }}
    >
      <SceneBody />
    </Canvas>
  );
}
