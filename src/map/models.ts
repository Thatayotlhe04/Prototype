import maplibregl from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Blender → map, the honest version:
 *
 * The BASE 3D you see (extruded buildings) comes free from OSM/Overture footprints
 * in MapLibre — Blender is NOT involved in that, and you should not try to render
 * the whole city in Blender.
 *
 * Blender's job is the *hero landmark* layer (the sculpted models in the Apple-Maps
 * screenshots): model the National Stadium, Three Dikgosi Monument, Parliament, etc.
 * in Blender, export each as glTF 2.0 (.glb), and drop it on the map here as a real
 * 3D object anchored to its true coordinate. Keep them low-poly (a few k tris) so
 * the map stays smooth.
 *
 *   addModel(map, { id:'stadium', url:'/models/national-stadium.glb',
 *                   lng:25.9249, lat:-24.6478, altitude:0,
 *                   scale:1, rotationDeg:[0,0,0] });
 *
 * Export settings in Blender: +Y up is fine (we rotate X by 90° below so the model
 * stands upright on the map), apply transforms, pack textures, draco optional.
 */
export interface ModelOpts {
  id: string;
  url: string;
  lng: number;
  lat: number;
  altitude?: number;            // metres above ground
  scale?: number;               // extra uniform scale on top of metre-accurate sizing
  rotationDeg?: [number, number, number];
}

export function addModel(map: maplibregl.Map, opts: ModelOpts): void {
  const altitude = opts.altitude ?? 0;
  const anchor = maplibregl.MercatorCoordinate.fromLngLat([opts.lng, opts.lat], altitude);
  // metres → mercator units at this latitude
  const mScale = anchor.meterInMercatorCoordinateUnits() * (opts.scale ?? 1);
  const rot = opts.rotationDeg ?? [0, 0, 0];
  const d2r = Math.PI / 180;

  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;

  const layer: maplibregl.CustomLayerInterface = {
    id: opts.id,
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 1.4));
      const dir = new THREE.DirectionalLight(0xffffff, 1.1);
      dir.position.set(0.4, -0.7, 1).normalize();
      scene.add(dir);

      new GLTFLoader().load(opts.url, (gltf) => scene.add(gltf.scene));

      renderer = new THREE.WebGLRenderer({ canvas: _map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(_gl, args) {
      // MapLibre v4+ passes a render args object with the projection matrix.
      const m = new THREE.Matrix4().fromArray((args as any).defaultProjectionData?.mainMatrix ?? (args as unknown as number[]));
      const l = new THREE.Matrix4()
        .makeTranslation(anchor.x, anchor.y, anchor.z as number)
        .scale(new THREE.Vector3(mScale, -mScale, mScale))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))            // stand upright on the map plane
        .multiply(new THREE.Matrix4().makeRotationX(rot[0] * d2r))
        .multiply(new THREE.Matrix4().makeRotationY(rot[1] * d2r))
        .multiply(new THREE.Matrix4().makeRotationZ(rot[2] * d2r));
      camera.projectionMatrix = m.multiply(l);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    }
  };

  if (map.isStyleLoaded()) map.addLayer(layer);
  else map.once('load', () => map.addLayer(layer));
}
