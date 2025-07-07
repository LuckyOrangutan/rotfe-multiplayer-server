const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174", "https://rotfe.vercel.app", "*"],
    methods: ["GET", "POST"]
  }
});

// Store active lobbies
const lobbies = new Map();
const playerSocketMap = new Map(); // Track which socket belongs to which player

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    lobbies: lobbies.size,
    players: playerSocketMap.size 
  });
});

// Generate random lobby ID
function generateLobbyId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Clean up empty lobbies
function cleanupLobby(lobbyId) {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  
  if (lobby.players.length === 0) {
    lobbies.delete(lobbyId);
    console.log(`Deleted empty lobby ${lobbyId}`);
  }
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  let currentLobbyId = null;
  let playerData = null;
  
  // Create lobby
  socket.on('create-lobby', (data, callback) => {
    const { playerId, playerName } = data;
    const lobbyId = generateLobbyId();
    
    playerData = {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      ready: false
    };
    
    const lobby = {
      id: lobbyId,
      hostId: playerId,
      players: [playerData],
      status: 'waiting',
      gameState: null
    };
    
    lobbies.set(lobbyId, lobby);
    playerSocketMap.set(playerId, socket.id);
    currentLobbyId = lobbyId;
    
    socket.join(lobbyId);
    console.log(`Player ${playerName} created lobby ${lobbyId}`);
    
    callback({ success: true, lobbyId });
    
    // Send initial lobby update
    io.to(lobbyId).emit('lobby-update', lobby);
  });
  
  // Join lobby
  socket.on('join-lobby', (data, callback) => {
    const { lobbyId, playerId, playerName } = data;
    const lobby = lobbies.get(lobbyId);
    
    if (!lobby) {
      callback({ success: false, error: 'Lobby not found' });
      return;
    }
    
    // Check if player is already in lobby (reconnecting)
    const existingPlayer = lobby.players.find(p => p.id === playerId);
    if (existingPlayer) {
      // Update socket ID for reconnection
      existingPlayer.socketId = socket.id;
      playerSocketMap.set(playerId, socket.id);
      currentLobbyId = lobbyId;
      playerData = existingPlayer;
      socket.join(lobbyId);
      
      console.log(`Player ${playerName} reconnected to lobby ${lobbyId}`);
      callback({ success: true });
      io.to(lobbyId).emit('lobby-update', lobby);
      return;
    }
    
    // Check if lobby is full
    if (lobby.players.length >= 2) {
      callback({ success: false, error: 'Lobby is full' });
      return;
    }
    
    // Check if game already started
    if (lobby.status === 'in-game') {
      callback({ success: false, error: 'Game already in progress' });
      return;
    }
    
    playerData = {
      id: playerId,
      socketId: socket.id,
      name: playerName,
      ready: false
    };
    
    lobby.players.push(playerData);
    playerSocketMap.set(playerId, socket.id);
    currentLobbyId = lobbyId;
    
    socket.join(lobbyId);
    console.log(`Player ${playerName} joined lobby ${lobbyId}`);
    
    callback({ success: true });
    
    // Notify all players in lobby
    io.to(lobbyId).emit('lobby-update', lobby);
  });
  
  // Leave lobby
  socket.on('leave-lobby', () => {
    if (!currentLobbyId || !playerData) return;
    
    const lobby = lobbies.get(currentLobbyId);
    if (!lobby) return;
    
    // Remove player from lobby
    lobby.players = lobby.players.filter(p => p.id !== playerData.id);
    playerSocketMap.delete(playerData.id);
    
    // If host left, transfer host to next player
    if (lobby.hostId === playerData.id && lobby.players.length > 0) {
      lobby.hostId = lobby.players[0].id;
      console.log(`Transferred host to ${lobby.players[0].name} in lobby ${currentLobbyId}`);
    }
    
    socket.leave(currentLobbyId);
    console.log(`Player ${playerData.name} left lobby ${currentLobbyId}`);
    
    // Update lobby
    io.to(currentLobbyId).emit('lobby-update', lobby);
    
    // Clean up empty lobbies
    cleanupLobby(currentLobbyId);
    
    currentLobbyId = null;
    playerData = null;
  });
  
  // Toggle ready
  socket.on('toggle-ready', () => {
    if (!currentLobbyId || !playerData) return;
    
    const lobby = lobbies.get(currentLobbyId);
    if (!lobby) return;
    
    const player = lobby.players.find(p => p.id === playerData.id);
    if (player) {
      player.ready = !player.ready;
      console.log(`Player ${player.name} is ${player.ready ? 'ready' : 'not ready'}`);
      io.to(currentLobbyId).emit('lobby-update', lobby);
    }
  });
  
  // Start game
  socket.on('start-game', (initialGameState) => {
    if (!currentLobbyId || !playerData) return;
    
    const lobby = lobbies.get(currentLobbyId);
    if (!lobby || lobby.hostId !== playerData.id) {
      console.log('Only host can start the game');
      return;
    }
    
    // Check if all players are ready
    if (!lobby.players.every(p => p.ready)) {
      console.log('Not all players are ready');
      return;
    }
    
    lobby.status = 'in-game';
    lobby.gameState = initialGameState;
    
    console.log(`Game started in lobby ${currentLobbyId}`);
    io.to(currentLobbyId).emit('lobby-update', lobby);
    io.to(currentLobbyId).emit('game-started', initialGameState);
  });
  
  // Game state update
  socket.on('game-state-update', (gameState) => {
    if (!currentLobbyId) return;
    
    const lobby = lobbies.get(currentLobbyId);
    if (!lobby || lobby.status !== 'in-game') return;
    
    // Update lobby's game state
    lobby.gameState = gameState;
    
    // Broadcast to all players in the lobby
    socket.to(currentLobbyId).emit('game-state-sync', gameState);
    
    console.log(`Game state updated in lobby ${currentLobbyId}, turn ${gameState.turn}`);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Don't remove player immediately - they might reconnect
    if (currentLobbyId && playerData) {
      const lobby = lobbies.get(currentLobbyId);
      if (lobby) {
        console.log(`Player ${playerData.name} disconnected from lobby ${currentLobbyId} (may reconnect)`);
        
        // Mark player as disconnected but don't remove them
        const player = lobby.players.find(p => p.id === playerData.id);
        if (player) {
          player.disconnected = true;
          io.to(currentLobbyId).emit('lobby-update', lobby);
        }
        
        // Set a timeout to remove the player if they don't reconnect
        setTimeout(() => {
          const currentLobby = lobbies.get(currentLobbyId);
          if (currentLobby) {
            const stillDisconnected = currentLobby.players.find(p => p.id === playerData.id && p.disconnected);
            if (stillDisconnected) {
              console.log(`Removing disconnected player ${playerData.name} from lobby ${currentLobbyId}`);
              socket.emit('leave-lobby');
            }
          }
        }, 30000); // 30 seconds to reconnect
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`RotFE Multiplayer Server running on port ${PORT}`);
});
