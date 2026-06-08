import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });

// roomCode -> { players: [ws1, ws2], used: [[], []] }
const rooms = new Map();

function send(ws, type, data = {}) {
  ws.send(JSON.stringify({ type, ...data }));
}

wss.on("connection", ws => {
  ws.on("message", msg => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch {
      return;
    }

    /* -------------------------
       JOIN ROOM
    ------------------------- */
    if (data.type === "join") {
      let room = rooms.get(data.room);

      if (!room) {
        room = { players: [], used: [[], []] };
        rooms.set(data.room, room);
      }

      if (room.players.length >= 2) {
        send(ws, "full");
        return;
      }

      room.players.push(ws);
      const playerIndex = room.players.length - 1;

      send(ws, "joined", { room: data.room });

      // Start game when 2 players present
      if (room.players.length === 2) {
        room.players.forEach((p, i) =>
          send(p, "start", { playerIndex: i })
        );
      }
    }

    /* -------------------------
       TURN (simultaneous reveal)
    ------------------------- */
    if (data.type === "turn") {
      const room = rooms.get(data.room);
      if (!room) return;

      const playerIndex = room.players.indexOf(ws);
      if (playerIndex === -1) return;

      const move = data.move;

      // Prevent repeat types
      if (room.used[playerIndex].includes(move)) {
        send(ws, "invalid", { reason: "Type already used" });
        return;
      }

      // Record the move
      room.used[playerIndex].push(move);

      // Relay to opponent
      room.players.forEach(p => {
        if (p !== ws) send(p, "turn", { move });
      });
    }
  });

  /* -------------------------
     DISCONNECT
  ------------------------- */
  ws.on("close", () => {
    for (let [roomCode, room] of rooms.entries()) {
      const idx = room.players.indexOf(ws);
      if (idx !== -1) {
        // Remove player
        room.players.splice(idx, 1);
        room.used.splice(idx, 1);

        // Notify remaining player
        room.players.forEach(p => send(p, "opponent_left"));

        // Delete empty room
        if (room.players.length === 0) {
          rooms.delete(roomCode);
        }
      }
    }
  });
});
