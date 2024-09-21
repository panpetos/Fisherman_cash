import React, { useState, useRef, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Vector3, AnimationMixer, AnimationClip, Euler } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

const Fisherman = ({ position, rotation, animation }) => {
  const groupRef = useRef();
  const mixerRef = useRef();
  const animationsRef = useRef();

  const modelPath = '/fisherman.glb';

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltfModel) => {
        groupRef.current.add(gltfModel.scene);

        animationsRef.current = gltfModel.animations.map((clip) => {
          const tracks = clip.tracks.filter((track) => !track.name.includes('rotation'));
          return new AnimationClip(clip.name, clip.duration, tracks);
        });

        mixerRef.current = new AnimationMixer(gltfModel.scene);

        playAnimation('Idle');
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
      }
    );
  }, []);

  const playAnimation = (animationName, loop = true) => {
    if (!animationsRef.current || !mixerRef.current) return;
    const animationClip = animationsRef.current.find((clip) => clip.name === animationName);
    if (animationClip) {
      mixerRef.current.stopAllAction();
      const action = mixerRef.current.clipAction(animationClip);
      action.reset();
      action.setLoop(loop ? Infinity : 1);
      action.play();
    }
  };

  useEffect(() => {
    playAnimation(animation, animation !== 'Idle');
  }, [animation]);

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    if (groupRef.current) {
      groupRef.current.position.set(...position);
      groupRef.current.rotation.copy(new Euler(0, rotation, 0)); // Поворачиваем персонажа по оси Y в сторону движения
    }
  });

  return <group ref={groupRef} />;
};

// Camera follows the player
const FollowCamera = ({ playerPosition, cameraRotation, cameraTargetRotation, isPlayerMoving }) => {
  const { camera } = useThree();
  const distance = 10; // Distance from camera to player
  const height = 5; // Camera height relative to player
  const smoothFactor = 0.1; // For smooth camera movement

  useFrame(() => {
    if (camera) {
      const targetRotation = isPlayerMoving ? cameraTargetRotation : cameraRotation;
      const currentRotation = cameraRotation + (targetRotation - cameraRotation) * smoothFactor;
      const offset = new Vector3(
        -Math.sin(currentRotation) * distance,
        height,
        Math.cos(currentRotation) * distance
      );
      camera.position.copy(new Vector3(...playerPosition).add(offset));
      camera.lookAt(new Vector3(...playerPosition));
    }
  });

  return null;
};

const TexturedFloor = () => {
  const texture = useLoader(
    TextureLoader,
    'https://cdn.wikimg.net/en/strategywiki/images/thumb/c/c4/TABT-Core-Very_Short-Map7.jpg/450px-TABT-Core-Very_Short-Map7.jpg'
  );
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
};

const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraTargetRotation, setCameraTargetRotation] = useState(0);
  const [players, setPlayers] = useState({});
  const [currentAnimation, setCurrentAnimation] = useState('Idle');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlayerMoving, setIsPlayerMoving] = useState(false);
  const movementDirectionRef = useRef({ x: 0, y: 0 });

  // Connect to the server
  const handleConnect = () => {
    setIsLoading(true);
    setIsConnected(true);
    socket = io('https://brandingsite.store:5000');

    socket.on('connect', () => {
      console.log('Connected to server with id:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setIsLoading(false);
    });

    socket.emit('requestPlayers');
  };

  // Handle player movement
  const handleMove = ({ x, y }) => {
    if (x === 0 && y === 0) {
      handleStop(); // Stop animation when there's no movement
      return;
    }

    movementDirectionRef.current = { x, y }; // Update movement direction

    const movementSpeed = 0.2;
    const cameraDirection = new Vector3(-Math.sin(cameraRotation), 0, Math.cos(cameraRotation)).normalize();
    const rightVector = new Vector3(Math.cos(cameraRotation), 0, Math.sin(cameraRotation)).normalize();
    const forwardMovement = cameraDirection.clone().multiplyScalar(-y * movementSpeed);
    const rightMovement = rightVector.clone().multiplyScalar(x * movementSpeed);
    const newPosition = new Vector3(
      playerPosition[0] + forwardMovement.x + rightMovement.x,
      playerPosition[1],
      playerPosition[2] + forwardMovement.z + rightMovement.z
    );

    setPlayerPosition(newPosition.toArray());
    const movementDirection = forwardMovement.clone().add(rightMovement);

    // Calculate the angle based on movement direction
    const directionAngle = Math.atan2(movementDirection.x, movementDirection.z);
    setPlayerRotation(directionAngle); // Rotate player to face the movement direction
    setCameraTargetRotation(directionAngle); // Rotate camera towards movement
    setIsPlayerMoving(true);

    if (currentAnimation !== 'Runing') {
      setCurrentAnimation('Runing'); // Use the correct "Run" animation name
    }

    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle,
      animation: 'Runing', // Correct animation name
    });
  };

  // Stop character and switch to Idle
  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setIsPlayerMoving(false);
    if (currentAnimation !== 'Idle') {
      setCurrentAnimation('Idle');
    }

    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animation: 'Idle',
    });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (movementDirectionRef.current.x !== 0 || movementDirectionRef.current.y !== 0) {
        handleMove(movementDirectionRef.current);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [cameraRotation, playerPosition]);

  // Smoothly update camera rotation
  useEffect(() => {
    const updateCameraRotation = () => {
      setCameraRotation((prev) => {
        const deltaRotation = cameraTargetRotation - prev;
        const normalizedDelta = ((deltaRotation + Math.PI) % (2 * Math.PI)) - Math.PI;
        const newRotation = prev + normalizedDelta * 0.1;
        return newRotation % (2 * Math.PI);
      });
    };

    const interval = setInterval(updateCameraRotation, 16); // Update every ~16ms (~60fps)
    return () => clearInterval(interval);
  }, [cameraTargetRotation]);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        position: 'relative',
        backgroundImage: 'url(/nebo.jpg)',
        backgroundSize: 'cover',
      }}
    >
      {!isConnected ? (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundImage: 'url(/nebo.jpg)',
            backgroundSize: 'cover',
          }}
        >
          <h1>FunFishing</h1>
          <button onClick={handleConnect} style={{ padding: '10px 20px', fontSize: '16px' }}>
            Войти в общий сервер
          </button>
        </div>
      ) : isLoading ? (
        <div
          style={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundImage: 'url(/nebo.jpg)',
            backgroundSize: 'cover',
          }}
        >
          <h1>Загрузка...</h1>
        </div>
      ) : (
        <>
          <Canvas>
            <Suspense fallback={null}>
              <ambientLight />
              <pointLight position={[10, 10, 10]} />
              <FollowCamera
                playerPosition={playerPosition}
                cameraRotation={cameraRotation}
                cameraTargetRotation={cameraTargetRotation}
                isPlayerMoving={isPlayerMoving}
              />
              {Object.keys(players).map((id) => (
                <Fisherman
                  key={id}
                  position={players[id].position}
                  rotation={players[id].rotation || 0}
                  animation={players[id].animation || 'Idle'}
                />
              ))}
              <TexturedFloor />
            </Suspense>
          </Canvas>

          <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
            <Joystick size={80} baseColor="gray" stickColor="black" move={handleMove} stop={handleStop} />
          </div>

          <div style={{ position: 'absolute', top: 10, right: 20, color: 'white', fontSize: '18px' }}>
            Игроков онлайн: {Object.keys(players).length}
          </div>
        </>
      )}
    </div>
  );
};

export default App;
