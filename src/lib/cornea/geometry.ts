import {
  BufferAttribute,
  BufferGeometry,
  LatheGeometry,
  Shape,
  ShapeGeometry,
  Vector2,
} from "three";
import { asphericSag, type CorneaParams } from "./optics";

export function corneaProfile(p: CorneaParams): Vector2[] {
  const pts: Vector2[] = [];
  const rMax = p.diameterMm / 2;
  const rPost = rMax * 0.97;
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const r = (i / steps) * rMax;
    pts.push(new Vector2(r, asphericSag(r, p.anteriorRadiusMm, p.qAnterior)));
  }
  const zA = asphericSag(rMax, p.anteriorRadiusMm, p.qAnterior);
  const zP = p.thicknessMm + asphericSag(rPost, p.posteriorRadiusMm, p.qPosterior);
  pts.push(new Vector2(rMax + 0.14, (zA + zP) * 0.5));
  for (let i = steps; i >= 0; i--) {
    const r = (i / steps) * rPost;
    pts.push(new Vector2(r, p.thicknessMm + asphericSag(r, p.posteriorRadiusMm, p.qPosterior)));
  }
  return pts;
}

export function buildCorneaGeometry(p: CorneaParams, cutaway: boolean): LatheGeometry {
  const pts = corneaProfile(p);
  const phiLength = cutaway ? Math.PI * 1.28 : Math.PI * 2;
  const geo = new LatheGeometry(pts, cutaway ? 72 : 96, cutaway ? -0.42 : 0, phiLength);
  geo.rotateX(Math.PI / 2);
  applyKeratoconus(geo, p.keratoconus);
  geo.computeVertexNormals();
  return geo;
}

export function buildCutFace(p: CorneaParams): BufferGeometry {
  const rMax = p.diameterMm / 2;
  const rPost = rMax * 0.97;
  const steps = 48;
  const shape = new Shape();
  const zA0 = asphericSag(rMax, p.anteriorRadiusMm, p.qAnterior);
  shape.moveTo(zA0, -rMax);
  for (let i = -steps + 1; i <= steps; i++) {
    const r = (i / steps) * rMax;
    shape.lineTo(asphericSag(Math.abs(r), p.anteriorRadiusMm, p.qAnterior), r);
  }
  const zP = p.thicknessMm + asphericSag(rPost, p.posteriorRadiusMm, p.qPosterior);
  shape.lineTo(zP, rPost);
  for (let i = steps; i >= -steps; i--) {
    const r = (i / steps) * rPost;
    const z = p.thicknessMm + asphericSag(Math.abs(r), p.posteriorRadiusMm, p.qPosterior);
    shape.lineTo(z, r);
  }
  shape.closePath();
  const geo = new ShapeGeometry(shape, 8);
  geo.rotateY(-Math.PI / 2);
  applyKeratoconus(geo, p.keratoconus);
  paintLayerColors(geo, p);
  return geo;
}

function applyKeratoconus(geo: BufferGeometry, amount: number) {
  if (amount <= 0) return;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dx = x;
    const dy = y + 2.15;
    const d2 = dx * dx + dy * dy;
    const bump = amount * 0.62 * Math.exp(-d2 / 7.4);
    pos.setZ(i, z + bump);
  }
  pos.needsUpdate = true;
}

function paintLayerColors(geo: BufferGeometry, p: CorneaParams) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const t = Math.max(p.thicknessMm, 0.2);
  const layers = [
    { end: 50 / 535, c: [0.86, 0.88, 0.86] },
    { end: 62 / 535, c: [0.78, 0.81, 0.79] },
    { end: 512 / 535, c: [0.91, 0.93, 0.94] },
    { end: 522 / 535, c: [0.72, 0.76, 0.78] },
    { end: 1, c: [0.62, 0.68, 0.66] },
  ];
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    const sag = asphericSag(r, p.anteriorRadiusMm, p.qAnterior);
    const depth = (z - sag) / t;
    let c = layers[layers.length - 1].c;
    for (const layer of layers) {
      if (depth <= layer.end) {
        c = layer.c;
        break;
      }
    }
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute("color", new BufferAttribute(colors, 3));
}
