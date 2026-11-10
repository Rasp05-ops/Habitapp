import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function FeatureScene({ active }: { active: number | null }) {
  const host = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const root = host.current;
    if (!root) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    const material = new THREE.MeshStandardMaterial({ color: 0x0042af, roughness: 0.28, metalness: 0.12 });
    const detail = new THREE.MeshStandardMaterial({ color: 0xf6e4b8, roughness: 0.35, metalness: 0.08 });
    const objects = [
      new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 1), material),
      new THREE.Mesh(new THREE.TorusKnotGeometry(0.54, 0.15, 96, 14), detail),
      new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), material),
    ];
    objects[0].position.set(-1.35, 0.25, 0);
    objects[1].position.set(0.1, -0.55, 0.25);
    objects[2].position.set(1.35, 0.28, -0.1);
    objects[2].rotation.set(0.4, 0.5, 0.2);
    objects.forEach((object) => group.add(object));

    scene.add(new THREE.AmbientLight(0xfef1d0, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(3, 4, 5);
    scene.add(key);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let disposed = false;
    const resize = () => {
      const width = root.clientWidth || 1;
      const height = root.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    const animate = (time: number) => {
      if (disposed) return;
      const seconds = time * 0.001;
      group.rotation.y = reduceMotion ? -0.12 : seconds * 0.22;
      group.rotation.x = reduceMotion ? 0.04 : Math.sin(seconds * 0.55) * 0.08;
      objects.forEach((object, index) => {
        const selected = activeRef.current === index;
        const target = selected ? 1.22 : 1;
        object.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
        if (!reduceMotion) object.rotation.x += 0.003 + index * 0.0007;
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      objects.forEach((object) => {
        object.geometry.dispose();
        if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
        else object.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} className="feature-scene" aria-hidden="true" />;
}
