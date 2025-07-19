const express = require('express');
const http = require('http');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

// Struktur penyimpanan room
const rooms = {};

io.on('connection', (socket) => {
  console.log("🔌 Client terhubung:", socket.id);

  // Saat pemain join room
  socket.on("joinRoom", ({ roomId, username, jumlahBom }) => {
    socket.join(roomId);

    // Buat room baru jika belum ada
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        turn: null,
        board: Array(64).fill(null),
        usedTiles: new Set(),
        bomCount: parseInt(jumlahBom) || 10,
      };
    }

    // Tambahkan pemain ke room
    const room = rooms[roomId];
    if (!room.players.find(p => p.username === username)) {
      room.players.push({ username, id: socket.id });
    }

    // Jika sudah 2 pemain, mulai game
    if (room.players.length === 2) {
      // Pilih player pertama secara acak
      const giliran = room.players[Math.floor(Math.random() * 2)].username;
      room.turn = giliran;

      // Buat posisi bom acak
      let bombIndexes = [];
      while (bombIndexes.length < room.bomCount) {
        let index = Math.floor(Math.random() * 64);
        if (!bombIndexes.includes(index)) {
          bombIndexes.push(index);
          room.board[index] = "bomb";
        }
      }

      io.to(roomId).emit("startGame", { turn: giliran });
    }
  });

  // Saat ubin diklik
  socket.on("clickTile", ({ roomId, index }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || room.turn !== player.username) return; // Bukan giliran dia

    if (room.usedTiles.has(index)) return;

    room.usedTiles.add(index);
    let result = room.board[index] || "coin";

    // Ganti giliran ke pemain lain
    const next = room.players.find(p => p.username !== player.username);
    room.turn = next.username;

    // Kirim hasil ke semua pemain
    io.to(roomId).emit("tileResult", {
      index,
      value: result,
      nextTurn: next.username
    });
  });

  // Chat antar pemain
  socket.on("chatMessage", ({ roomId, username, msg }) => {
    io.to(roomId).emit("chatMessage", { username, msg });
  });

  // Pemain disconnect
  socket.on("disconnect", () => {
    console.log("❌ Client keluar:", socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
