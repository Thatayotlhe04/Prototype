# Hero landmark models (Blender → glTF)

Drop your Blender exports here as `.glb` (glTF 2.0 binary), then register them in
`src/main.ts`:

```ts
import { addModel } from './map/models';
// after the map is created:
addModel(map, { id: 'stadium', url: '/models/national-stadium.glb',
                lng: 25.9249, lat: -24.6478, rotationDeg: [0, 0, 0] });
```

Guidelines
- Keep each model low-poly (a few thousand triangles). The base city buildings are
  already drawn from OSM data — these models are only for standout landmarks.
- Export from Blender: glTF 2.0 (.glb), apply transforms, pack/embed textures,
  Draco compression optional. Real-world metre scale (the loader sizes models in
  metres at Gaborone's latitude).
- Anchor each model at its true [lng, lat]. Nudge `rotationDeg` to face it right.

Candidates: National Stadium, Three Dikgosi Monument, Parliament, Main Mall,
Sir Seretse Khama Airport terminal.
