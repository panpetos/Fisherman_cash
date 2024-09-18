const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');

const privateKey = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/privkey.pem', 'utf8');
const certificate = fs.readFileSync('/etc/letsencrypt/live/brandingsite.store-0001/fullchain.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app);
const io = socketIo(server, {
  cors: {
    origin: ['https://eleonhrcenter.com'],
    methods: ['GET', 'POST'],
  },
});

const players = {};

io.on('connection', (socket) => {
  console.log('New client connected', socket.id);

  // Инициализируем нового игрока
  players[socket.id] = {
    id: socket.id,
    position: [0, 0, 0],
    rotation: 0,
    animationName: 'Idle',
  };

  // Отправляем состояние текущему игроку
  socket.emit('initPlayer', players[socket.id], players);

  // Обновляем данные игрока и передаем их всем, кроме самого игрока
  socket.on('playerMove', (data) => {
    if (players[socket.id]) {
      players[socket.id] = {
        ...players[socket.id],
        position: data.position,
        rotation: data.rotation,
        animationName: data.animationName,
      };

      // Передаем обновленные данные всем, кроме самого отправителя
      socket.broadcast.emit('updatePlayers', {
        [socket.id]: players[socket.id],
      });
    }
  });

  // Удаляем игрока при отключении
  socket.on('disconnect', () => {
    console.log('Client disconnected', socket.id);
    delete players[socket.id];
    io.emit('updatePlayers', players);
  });
});

server.listen(5000, () => {
  console.log('Server is running on https://brandingsite.store:5000');
});
