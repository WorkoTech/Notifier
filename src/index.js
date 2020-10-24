const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const jwt = require('jsonwebtoken');

const cors = require('cors');
const morgan = require('morgan');

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/ping', (req, res) => {
    return res.status(200).end();
});

app.post('/notify', (req, res) => {
    const { channel, event, data } = req.body;

    console.log('req.body : ', req.body);

    console.log(`Got /notify { channel = ${channel}, event = ${event}, data = ${data} }`);
    if (!channel || !event) {
        return res.status(400).end();
    }
    console.log(`sending event ${event} to channel ${channel} with payload ${{ channel, data }}`)
    io.in(channel).emit(event, { channel, data });
    return res.status(200).end();
});

io.on('connection', ws => {
    // CHECK TOKEN
    if (!ws.handshake.query.token) {
        ws.disconnect();
        return ;
    }

    // DECODE IT
    const splitedToken = ws.handshake.query.token.split(' ').map(x => x.trim())
    let token = jwt.decode(splitedToken[1]);
    if (!token || !token.userId) {
        console.log('Got wrongly formatted token');
        ws.disconnect();
        return;
    }

    // JOIN USER SPECIFIC CHANNEL
    ws.join('user ' + token.userId);

    // EVENT TO JOIN / LEAVE CHANNELS
    ws.on('join', channel => {
        console.log(`User ${token.userId} joining channel ${channel}`);
        ws.join(channel);
    });

    ws.on('leave', channel => {
        console.log(`User ${token.userId} leaving channel ${channel}`);
        ws.leave(channel);
    });

    // SIMPLE LOGGING, might be removed
    ws.on('disconnect', () => {
        console.log(`User ${token.userId} disconnected`);
    });
});

http.listen(process.env.NOTIFIER_PORT || 3005, () => {
    console.log('Express server listening on '
        + (http.address().address == '::' ? '127.0.0.1' : http.address().address)
        + ':'
        + http.address().port
        + '...'
    );
});
