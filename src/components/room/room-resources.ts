import { Mesh, Texture, type Object3D } from 'three';

type Resource = { dispose: () => void };
const consumers = new WeakMap<Resource, number>();

// dispose() releases GPU allocations/listeners, keeping GLTF data reusable.
export function retainRoomResources(resources: Set<Resource>) {
  for (const resource of resources) {
    consumers.set(resource, (consumers.get(resource) ?? 0) + 1);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const resource of resources) {
      const remaining = (consumers.get(resource) ?? 1) - 1;
      if (remaining > 0) consumers.set(resource, remaining);
      else {
        consumers.delete(resource);
        resource.dispose();
      }
    }
  };
}

export function retainRoomModel(object: Object3D) {
  const resources = new Set<Resource>();
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    resources.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof Texture) resources.add(value);
      }
    }
  });
  return retainRoomResources(resources);
}
