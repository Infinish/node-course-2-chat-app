const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const { generateMessage, generateLocationMessage } = require('./utils/messages');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./utils/users');


const app = express();
const server = http.createServer(app);
const io = socketio(server);

// we use either an already made port or port 3000
const port = process.env.PORT || 3000;
// we use the path in public to access the html file
const publicDirectoryPath = path.join(__dirname, '../public');

// we use app.use = express.static(rootPath), for its middleware
app.use(express.static(publicDirectoryPath));

// whenever a client is connected to the server these actions will take place
io.on('connection', (socket) => {
    console.log('New WebSocket connection');

    // listens for join emit 
    socket.on('join', ({ username, room }, callback) => {
        const { error, user } = addUser({ id: socket.id, username, room });

        if (error) {
            return callback(error);
        }

        socket.join(user.room);

         // emits welcome message to the user who has joined
        socket.emit('message', generateMessage('Admin', 'Welcome!'));
        // emits message to all users (besides the user that joined) that a new user has joined
        socket.broadcast.to(user.room).emit('message', generateMessage('Admin', `${user.username} has joined!`));

        io.to(user.room).emit('roomData', {
            room: user.room,
            users:  getUsersInRoom(user.room)
        });

        callback();
    });

    // recieves message from client and emits message to client to log it
    socket.on('sendMessage', (message, callback) => {
        const user = getUser(socket.id);
        const filter = new Filter();

        if (filter.isProfane(message)) {
            return callback('Profanity is not allowed');
        }
        
        io.to(user.room).emit('message', generateMessage(user.username, message));
        callback();      
    });

    // recieves geolocation from client and emits googlemaps link back to client
    socket.on('sendLocation', (coords, callback) => {
        const user = getUser(socket.id);
        io.to(user.room).emit('locationMessage', generateLocationMessage(user.username,`https://google.com/maps?q=${coords.lat},${coords.long}`));
        callback();
    });

    // notifys users when another user has left
    socket.on('disconnect', () => {
        const user = removeUser(socket.id);

        if (user) {
            io.to(user.room).emit('message', generateMessage('Admin',`${user.username} has left.`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUsersInRoom(user.room)
            });
        }
    });
});

// sets up the client port that the server will access
server.listen(port, () => {
    console.log(`Server is up on port ${port}!`);
});


