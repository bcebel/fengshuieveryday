import { GLView } from "expo-gl";
import { Renderer, TextureLoader } from "expo-three";
import { useEffect, useState } from "react";
import { DeviceMotion, Magnetometer } from "expo-sensors";
import {
  AmbientLight,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
} from "three";
import * as THREE from "three";

export default function App() {
  let timeout;
  const [heading, setHeading] = useState(0);
  const [initialHeading, setInitialHeading] = useState(null);
  const [manualOffset, setManualOffset] = useState(0); // Manual adjustment for the photo's orientation

  useEffect(() => {
    return () => {
      clearTimeout(timeout);
      DeviceMotion.removeAllListeners();
      Magnetometer.removeAllListeners();
    };
  }, []);

  // Magnetometer for compass heading
  useEffect(() => {
    Magnetometer.setUpdateInterval(50);
    const magnetometerListener = Magnetometer.addListener(({ x, y, z }) => {
      const heading = Math.atan2(y, x) * (180 / Math.PI);
      setHeading(heading);

      if (initialHeading === null) {
        setInitialHeading(heading);
      }
    });

    return () => {
      magnetometerListener.remove();
    };
  }, [initialHeading]);

  const onContextCreate = async (gl) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);

    const camera = new PerspectiveCamera(140, width / height, 0.01, 1000);
    camera.position.set(0, 0, 0);

    const scene = new Scene();

    const ambientLight = new AmbientLight(0x404040);
    scene.add(ambientLight);

    const pointLight = new PointLight(0xffffff, 1);
    pointLight.position.set(0, 200, 200);
    scene.add(pointLight);

    const sphere = new IconMesh();
    scene.add(sphere);

    DeviceMotion.setUpdateInterval(50);

    // Smooth rotations using quaternions and combine with compass heading
    DeviceMotion.addListener(({ rotation }) => {
      if (rotation && initialHeading !== null) {
        const { alpha, beta, gamma } = rotation;

        // Lock pitch and roll (keep them vertical)
        const pitch = Math.max(Math.min(beta, 260), -260); // Clamp pitch within -80 to 80 degrees
        const roll = 0; // Lock roll to 0 to prevent side-to-side tilting

        // Calculate yaw (alpha) relative to the initial heading
        let yaw = alpha - initialHeading; // Initial yaw calculation
        yaw += manualOffset; // Apply manual offset for orientation correction

        // Normalize yaw to keep it within 0-360 degrees
        if (yaw < 0) yaw += 360;
        if (yaw >= 360) yaw -= 360;

        // Apply these values to the camera or the sphere
        const quaternion = new Quaternion();
        quaternion.setFromEuler(new THREE.Euler(pitch, yaw, roll, "XYZ"));
        camera.quaternion.slerp(quaternion, 0.1);

        // Optionally, apply rotation directly to the sphere as well
        sphere.rotation.x = pitch;
        sphere.rotation.y = MathUtils.degToRad(yaw); // Convert yaw to radians
        sphere.rotation.z = roll;
      }
    });

    const render = () => {
      timeout = requestAnimationFrame(render);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  return <GLView style={{ flex: 1 }} onContextCreate={onContextCreate} />;
}

class IconMesh extends Mesh {
  constructor() {
    const texture = new TextureLoader().load(require("./1.jpg"));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.x = -1;
    texture.repeat.y = 1;

    super(
      new SphereGeometry(50, 32, 32),
      new MeshStandardMaterial({
        map: texture,
        side: THREE.BackSide,
      })
    );

    this.rotation.set(180, 180, 180); // Initial photo rotation
  }
}
