import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

const rooms = new Map(); // roomCode -> { players: [ws1, ws2] }

function send(ws, type, data) {
  ws.send(JSON.stringify({ type, ...data }));
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    let data = JSON.parse(msg);

    if (data.type === "join") {
      let room = rooms.get(data.room) || { players: [] };

      if (room.players.length >= 2) {
        send(ws, "full", {});
        return;
      }

      room.players.push(ws);
      rooms.set(data.room, room);

      send(ws, "joined", { room: data.room });

      if (room.players.length === 2) {
        room.players.forEach((p, i) =>
          send(p, "start", { playerIndex: i })
        );
      }
    }

    if (data.type === "turn") {
      let room = rooms.get(data.room);
      if (!room) return;

      room.players.forEach(p => {
        if (p !== ws) send(p, "turn", { move: data.move });
      });
    }
  });

  ws.on("close", () => {
    for (let [roomCode, room] of rooms.entries()) {
      if (room.players.includes(ws)) {
        room.players = room.players.filter(p => p !== ws);
        room.players.forEach(p => send(p, "opponent_left", {}));
        if (room.players.length === 0) rooms.delete(roomCode);
      }
    }
  });
});
