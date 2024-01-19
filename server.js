const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MAX_PLAYERS = 2;
const rooms = {};

io.on("connection", (socket) => {
    socket.on('join', (data) => {
        const { playerName, roomId } = data;

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                currentPlayerIndex: 0,
                gameStarted: false,
            };
        }

        const room = rooms[roomId];

        if (room.players.length < MAX_PLAYERS) {
            const playerSymbol = room.players.length === 0 ? 'X' : 'O';
            room.players.push({ id: socket.id, name: playerName, symbol: playerSymbol });
            socket.join(roomId); // Join the room
            io.to(roomId).emit('updatePlayers', room.players);

            if (room.players.length === MAX_PLAYERS) {
                startGame(roomId);
            }
        } else {
            socket.emit('roomFull', 'The room is already full.');
        }
    });



    socket.on('move', (moveData) => {
        const roomId = Array.from(socket.rooms).find(roomId => roomId !== socket.id);
        const room = rooms[roomId];
    
        console.log('Room:', room);
    
        if (room && room.players) {
            const currentPlayer = room.players[room.currentPlayerIndex];
    
            console.log('Current Player:', currentPlayer);
    
            if (socket.id === currentPlayer.id) {
                moveData.symbol = currentPlayer.symbol;
                io.to(roomId).emit('makeMove', moveData);
    
                room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
                const nextPlayer = room.players[room.currentPlayerIndex];
                io.to(roomId).emit('updatePlayers', { players: room.players, nextPlayer });
            }
        } else {
            console.log('Invalid room or players:', room);
        }
    });
    
    socket.on('disconnect', () => {
        const roomId = Array.from(socket.rooms).find(roomId => roomId !== socket.id);
        const room = rooms[roomId];

        if (room && room.players) {
            const index = room.players.findIndex((player) => player.id === socket.id);

            if (index !== -1) {
                room.players.splice(index, 1);

                if (room.gameStarted && room.players.length < MAX_PLAYERS) {
                    room.gameStarted = false;
                }

                if (index === room.currentPlayerIndex) {
                    room.currentPlayerIndex = room.currentPlayerIndex % room.players.length;
                    io.to(roomId).emit('updatePlayers', { players: room.players, nextPlayer: room.players[room.currentPlayerIndex] });
                }
            }

            if (room.players.length === 0) {
                // No players in the room, remove the room
                delete rooms[roomId];
            }
        }
    });

    socket.on('disconnecting', ({ userId }) => {
        console.log(`User ${userId} is disconnecting.`);
        handleDisconnect(socket);
    });
    socket.on('playAgain', ({roomId}) => {
        const room = rooms[roomId];
        room.gameStarted = true;
        io.to(roomId).emit('gameReset', { players: room.players, nextPlayer: room.players[room.currentPlayerIndex] });
        io.to(roomId).emit('updatePlayers', { players: room.players, nextPlayer: room.players[room.currentPlayerIndex] });

    });

    function handleDisconnect(socket) {
        const roomId = Array.from(socket.rooms).find(roomId => roomId !== socket.id);
        const room = rooms[roomId];

        if (room && room.players) {
            const index = room.players.findIndex((player) => player.id === socket.id);

            if (index !== -1) {
                room.players.splice(index, 1);

                if (room.gameStarted && room.players.length < MAX_PLAYERS) {
                    room.gameStarted = false;
                    io.to(roomId).emit('gameStart', { players: room.players, nextPlayer: room.players[room.currentPlayerIndex] });
                }

                if (index === room.currentPlayerIndex) {
                    room.currentPlayerIndex = room.currentPlayerIndex % room.players.length;
                    io.to(roomId).emit('updatePlayers', { players: room.players, nextPlayer: room.players[room.currentPlayerIndex] });
                }
            }

            if (room.players.length === 0) {
                // No players in the room, remove the room
                delete rooms[roomId];
            }
        }
    }


    
    
});

function startGame(roomId) {
    const room = rooms[roomId];
    room.gameStarted = true;
    io.to(roomId).emit('gameStart', { players: room.players, nextPlayer: room.players[room.currentPlayerIndex] });
    io.to(roomId).emit('updatePlayers', { players: room.players, nextPlayer: room.players[room.currentPlayerIndex] });
}

app.use(express.static(path.resolve("./public")));

app.get("/", (req, res) => {
    res.sendFile("/public/index.html");
});

server.listen(process.env.PORT || 5001);
