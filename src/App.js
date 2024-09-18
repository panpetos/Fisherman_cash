import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useFBX } from '@react-three/drei';
import { Vector3 } from 'three';
import io from 'socket.io-client';
import { Joystick } from 'react-joystick-component';

let socket;

// Компонент игрока
const Player = ({ id, position, rotation, animationName, isLocalPlayer }) => {
  const group = useRef();
  const animations = {
    Idle: useFBX('/models_2/Idle.fbx'),
    Running: useFBX('/models_2/Running.fbx'),
    FishingIdle: useFBX('/models_2/Fishing_Idle.fbx'),
    TPose: useFBX('/models_2/T-Pose.fbx')
  };

  const [currentAnimation, setCurrentAnimation] = useState(null);

  // Следим за загрузкой анимаций и проверяем, что объект загружен
  useEffect(() => {
    if (animations[animationName] && animations[animationName].isObject3D) {
      const action = animations[animationName];
      setCurrentAnimation(action);
    } else {
      console.error('Анимация не загружена или неверный формат:', animationName);
    }
  }, [animationName, animations]);

  // Привязываем положение игрока к его анимации
  useEffect(() => {
    if (group.current) {
      group.current.position.set(...position);
      group.current.rotation.set(0, rotation, 0);
    }
  }, [position, rotation]);

  return (
    <group ref={group} visible={isLocalPlayer || id !== socket.id}>
      {currentAnimation && <primitive object={currentAnimation} />}
    </group>
  );
};

// Компонент камеры от третьего лица
const FollowCamera = ({ playerPosition, cameraRotation, cameraTargetRotation, isPlayerMoving }) => {
  const { camera } = useThree();
  const distance = 10;
  const height = 5;
  const smoothFactor = 0.05;

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

// Компонент пола
const TexturedFloor = () => {
  return (
    <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -1, 0]}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="green" />
    </mesh>
  );
};

// Основной компонент приложения
const App = () => {
  const [playerPosition, setPlayerPosition] = useState([0, 0, 0]);
  const [playerRotation, setPlayerRotation] = useState(0);
  const [cameraRotation, setCameraRotation] = useState(0);
  const [cameraTargetRotation, setCameraTargetRotation] = useState(0);
  const [animationName, setAnimationName] = useState('Idle');
  const [players, setPlayers] = useState({});
  const [isLocalPlayerMoving, setIsLocalPlayerMoving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [message, setMessage] = useState('');
  const movementDirectionRef = useRef({ x: 0, y: 0 });
  const stopTimeoutRef = useRef(null);

  // Соединение с сервером
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

    // Обновление данных других игроков
    socket.on('updatePlayers', (updatedPlayers) => {
      setPlayers((prevPlayers) => ({
        ...prevPlayers,
        ...updatedPlayers,
      }));
      setPlayerCount(Object.keys(updatedPlayers).length);
    });

    // Инициализация состояния игрока
    socket.on('initPlayer', (player, allPlayers) => {
      setPlayers(allPlayers);
      setPlayerPosition(player.position);
      setPlayerRotation(player.rotation);
      setAnimationName(player.animationName);
      setModelsLoaded(true);
      setIsLoading(false);
      setMessage('+1 игрок');
      setTimeout(() => setMessage(''), 2000);
    });

    // Запрашиваем текущих игроков у сервера
    socket.emit('requestPlayers');
  };

  // Движение локального игрока
  const handleMove = ({ x, y }) => {
    movementDirectionRef.current = { x, y };
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
    const directionAngle = Math.atan2(movementDirection.x, movementDirection.z);
    setPlayerRotation(directionAngle);
    setCameraTargetRotation(directionAngle);
    setIsLocalPlayerMoving(true);
    clearTimeout(stopTimeoutRef.current);

    setAnimationName('Running'); // Бег

    // Отправляем данные только для других игроков
    socket.emit('playerMove', {
      id: socket.id,
      position: newPosition.toArray(),
      rotation: directionAngle,
      animationName: 'Running',
    });
  };

  const handleStop = () => {
    movementDirectionRef.current = { x: 0, y: 0 };
    setAnimationName('Idle'); // Стойка
    setIsLocalPlayerMoving(false);

    // Обновляем состояние игрока на сервере
    socket.emit('playerMove', {
      id: socket.id,
      position: playerPosition,
      rotation: playerRotation,
      animationName: 'Idle',
    });

    stopTimeoutRef.current = setTimeout(() => {
      const reverseAngle = cameraRotation + Math.PI;
      setCameraTargetRotation(reverseAngle);
    }, 1000);
  };

  // Меню с предзагрузкой
  if (!isConnected) {
    return (
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
    );
  }

  // Отображение загрузки
  if (isLoading || !modelsLoaded) {
    return (
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
    );
  }

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
      <Canvas>
        <ambientLight />
        <pointLight position={[10, 10, 10]} />
        <FollowCamera
          playerPosition={playerPosition}
          cameraRotation={cameraRotation}
          cameraTargetRotation={cameraTargetRotation}
          isPlayerMoving={isLocalPlayerMoving}
        />
        {Object.keys(players).map((id) => (
          <Player
            key={id}
            id={id}
            position={players[id].position}
            rotation={players[id].rotation}
            animationName={players[id].animationName}
            isLocalPlayer={id === socket.id}
          />
        ))}
        <TexturedFloor />
      </Canvas>

      <div style={{ position: 'absolute', right: 20, bottom: 20 }}>
        <Joystick
          size={80}
          baseColor="gray"
          stickColor="black"
          move={handleMove}
          stop={handleStop}
        />
      </div>

      <button
        onClick={() => setAnimationName('FishingIdle')} // Забросить удочку
        style={{
          position: 'absolute',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          fontSize: '16px',
        }}
      >
        Забросить
      </button>

      {/* Отображение количества игроков и сообщения о подключении */}
      <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '12px', color: 'white' }}>
        <p>Игроков: {playerCount}</p>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default App;
