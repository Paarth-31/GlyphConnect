import { Server, Socket } from 'socket.io';
import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

// Track which socket is in which room so hang-up can reach the right peer
const roomMembers = new Map<string, Set<string>>(); // roomId → Set<socketId>
const socketRooms = new Map<string, string>();       // socketId → roomId

export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`[+] ${socket.id}`);

    // ── join-room ───────────────────────────────────────────────────────────
    socket.on('join-room', (roomId: string) => {
      if (!isValidRoomId(roomId)) { socket.emit('error', 'Invalid room ID'); return; }

      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size >= 2) { socket.emit('room-full'); return; }

      socket.join(roomId);
      socketRooms.set(socket.id, roomId);
      if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
      roomMembers.get(roomId)!.add(socket.id);

      // Tell the host a viewer arrived (sends viewer's socket.id)
      socket.to(roomId).emit('user-connected', socket.id);
      console.log(`  join ${socket.id} → room ${roomId}`);
    });

    // ── Screen-share offer (host → viewer) ──────────────────────────────────
    socket.on('call-user', (data) => {
      const { userToCall, signalData, from } = data;
      if (!isValidSDP(signalData)) return;
      io.to(userToCall).emit('incoming-call', { signal: signalData, from });
    });

    // ── AV call offer (caller → remote) — withVideo flag forwarded ──────────
    // Receiver auto-captures their own camera/mic and answers
    socket.on('av-call-user', (data) => {
      const { userToCall, signalData, from, withVideo } = data;
      if (!isValidSDP(signalData)) return;
      io.to(userToCall).emit('incoming-av-call', { signal: signalData, from, withVideo });
    });

    // ── Answer (answerer → offerer) ─────────────────────────────────────────
    socket.on('answer-call', (data) => {
      const { to, signal } = data;
      if (!isValidSDP(signal)) return;
      io.to(to).emit('call-accepted', { signal });
    });

    // ── ICE candidates ──────────────────────────────────────────────────────
    socket.on('ice-candidate', (data) => {
      const { target, candidate } = data;
      if (!isValidCandidate(candidate)) return;
      io.to(target).emit('ice-candidate', { candidate, from: socket.id });
    });

    // ── Hang-up: intentional end from one side — goes to a specific peer ────
    // data.to = target socket.id (not room ID)
    socket.on('hang-up', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`  hang-up ${socket.id} → ${data.to}`);
      io.to(data.to).emit('session-ended');   // use distinct event name
    });

    // ── Disconnect: broadcast session-ended to everyone in the room ─────────
    socket.on('disconnect', () => {
      console.log(`[-] ${socket.id}`);
      const roomId = socketRooms.get(socket.id);
      if (roomId) {
        socket.to(roomId).emit('session-ended');
        roomMembers.get(roomId)?.delete(socket.id);
        if (roomMembers.get(roomId)?.size === 0) roomMembers.delete(roomId);
        socketRooms.delete(socket.id);
      }
    });
  });
};
