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
  const [heading, setHeading] = useState(0); // State for storing the compass heading
  const [initialHeading, setInitialHeading] = useState(null); // To store the initial heading for North

  useEffect(() => {
    // Clear the animation loop and sensor listener when the component unmounts
    return () => {
      clearTimeout(timeout);
      DeviceMotion.removeAllListeners(); // Remove DeviceMotion listener
      Magnetometer.removeAllListeners(); // Remove Magnetometer listener
    };
  }, []);

  // Listen to the magnetometer data for the compass heading
  useEffect(() => {
    Magnetometer.setUpdateInterval(50); // Set update interval for magnetometer
    const magnetometerListener = Magnetometer.addListener(({ x, y, z }) => {
      const heading = Math.atan2(y, x) * (180 / Math.PI); // Convert to degrees
      setHeading(heading); // Store heading in state

      // Set initial heading on first read
      if (initialHeading === null) {
        setInitialHeading(heading); // Set the initial heading as North
      }
    });

    return () => {
      magnetometerListener.remove(); // Cleanup listener
    };
  }, [initialHeading]);

  const onContextCreate = async (gl) => {
    const { drawingBufferWidth: width, drawingBufferHeight: height } = gl;

    const renderer = new Renderer({ gl });
    renderer.setSize(width, height);

    const camera = new PerspectiveCamera(75, width / height, 0.01, 1000);
    camera.position.set(0, 0, 0); // Place the camera exactly at the center of the sphere

    const scene = new Scene();

    const ambientLight = new AmbientLight(0x404040);
    scene.add(ambientLight);

    const pointLight = new PointLight(0xffffff, 1);
    pointLight.position.set(0, 200, 200);
    scene.add(pointLight);

    const sphere = new IconMesh();
    scene.add(sphere);

    // Set DeviceMotion update interval
    DeviceMotion.setUpdateInterval(50);

    // Smooth rotations using quaternions and combine with compass heading
    DeviceMotion.addListener(({ rotation }) => {
      if (rotation && initialHeading !== null) {
        const { alpha, beta, gamma } = rotation;

        // Calculate yaw (alpha) relative to the initial heading (adjusting for the direction of North)
        const yaw = alpha - initialHeading; // Adjust yaw relative to the initial North

        // Apply tilt (pitch and roll)
        const pitch = MathUtils.degToRad((beta - 90) * 60); // Pitch (beta) controls forward/backward tilt
        const roll = MathUtils.degToRad(gamma * 60); // Roll (gamma) controls side-to-side tilt

        // Apply these values to the camera or the sphere
        const x = pitch;
        const y = MathUtils.degToRad(yaw * 60); // Yaw is adjusted by the initial heading to align with North
        const z = roll;

        const quaternion = new Quaternion();
        quaternion.setFromEuler(new THREE.Euler(x, y, z, "XYZ"));
        camera.quaternion.slerp(quaternion, 0.1); // Smoothly interpolate

        // Optional: Apply rotation directly to the sphere if you want it tilted too
        sphere.rotation.x = pitch;
        sphere.rotation.y = MathUtils.degToRad(yaw); // Heading controls rotation
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
    texture.repeat.x = -1; // Flip horizontally for inside view
    texture.repeat.y = 1; // Flip vertically for correct orientation

    super(
      new SphereGeometry(50, 32, 32), // Adjust size if necessary
      new MeshStandardMaterial({
        map: texture,
        side: THREE.BackSide, // Inside view of the sphere
      })
    );
  }
}
