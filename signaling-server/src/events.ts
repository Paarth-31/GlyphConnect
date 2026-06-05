// import { Server, Socket } from 'socket.io';
// import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

// // Track which socket is in which room so hang-up can reach the right peer
// const roomMembers = new Map<string, Set<string>>(); // roomId → Set<socketId>
// const socketRooms = new Map<string, string>();       // socketId → roomId

// export const setupSocketEvents = (io: Server) => {
//   io.on('connection', (socket: Socket) => {
//     console.log(`[+] ${socket.id}`);

//     // ── join-room ───────────────────────────────────────────────────────────
//     socket.on('join-room', (roomId: string) => {
//       if (!isValidRoomId(roomId)) { socket.emit('error', 'Invalid room ID'); return; }

//       const room = io.sockets.adapter.rooms.get(roomId);
//       if (room && room.size >= 2) { socket.emit('room-full'); return; }

//       socket.join(roomId);
//       socketRooms.set(socket.id, roomId);
//       if (!roomMembers.has(roomId)) roomMembers.set(roomId, new Set());
//       roomMembers.get(roomId)!.add(socket.id);

//       // Tell the host a viewer arrived (sends viewer's socket.id)
//       socket.to(roomId).emit('user-connected', socket.id);
//       console.log(`  join ${socket.id} → room ${roomId}`);
//     });

//     // ── Screen-share offer (host → viewer) ──────────────────────────────────
//     socket.on('call-user', (data) => {
//       const { userToCall, signalData, from } = data;
//       if (!isValidSDP(signalData)) return;
//       io.to(userToCall).emit('incoming-call', { signal: signalData, from });
//     });

//     // ── AV call offer (caller → remote) — withVideo flag forwarded ──────────
//     // Receiver auto-captures their own camera/mic and answers
//     socket.on('av-call-user', (data) => {
//       const { userToCall, signalData, from, withVideo } = data;
//       if (!isValidSDP(signalData)) return;
//       console.log(`  av-call ${from} → ${userToCall} (video: ${withVideo})`);
//       io.to(userToCall).emit('incoming-av-call', { signal: signalData, from, withVideo });
//     });

//     // ── Answer (answerer → offerer) ─────────────────────────────────────────
//     socket.on('answer-call', (data) => {
//       const { to, signal } = data;
//       if (!isValidSDP(signal)) return;
//       console.log(`  answer ${socket.id} → ${to}`);
//       io.to(to).emit('call-accepted', { signal });
//     });

//     // ── ICE candidates ──────────────────────────────────────────────────────
//     socket.on('ice-candidate', (data) => {
//       const { target, candidate } = data;
//       if (!isValidCandidate(candidate)) return;
//       io.to(target).emit('ice-candidate', { candidate, from: socket.id });
//     });

//     // ── Hang-up: intentional end from one side — goes to a specific peer ────
//     // data.to = target socket.id (not room ID)
//     socket.on('hang-up', (data: { to: string }) => {
//       if (!data?.to) return;
//       console.log(`  hang-up ${socket.id} → ${data.to}`);
//       io.to(data.to).emit('session-ended');   // use distinct event name
//     });

//     // ── Disconnect: broadcast session-ended to everyone in the room ─────────
//     socket.on('disconnect', () => {
//       console.log(`[-] ${socket.id}`);
//       const roomId = socketRooms.get(socket.id);
//       if (roomId) {
//         socket.to(roomId).emit('session-ended');
//         roomMembers.get(roomId)?.delete(socket.id);
//         if (roomMembers.get(roomId)?.size === 0) roomMembers.delete(roomId);
//         socketRooms.delete(socket.id);
//       }
//     });
//   });
// };





// signaling-server/src/events.ts
//
// NEW EVENTS ADDED:
//
// [ACCEPT] 'viewer-pending-ack' — host → server → viewer
//   Tells the viewer their request was received and they should wait.
//   Without this the viewer would just see "Disconnected" with no feedback.
//
// [ACCEPT] 'connection-accepted' — host → server → viewer
//   Host accepted the request. Viewer transitions from "waiting" to active
//   session state. The actual WebRTC offer follows via 'incoming-call'.
//
// [ACCEPT] 'connection-rejected' — host → server → viewer
//   Host declined. Viewer gets an alert and returns to HomePage.
//
// [AV-CALL] 'av-call-user' / 'incoming-av-call'
//   Separate AV call offer relay so it doesn't conflict with the screen-share
//   offer ('call-user' / 'incoming-call'). The viewer's hook listens for
//   'incoming-av-call' and prompts for camera/mic permission.
//
// [CLIPBOARD] 'clipboard-sync' — relayed between peers as a socket event
//   as a fallback when the clipboard DataChannel isn't open yet.
//
// [DISCONNECT] When a socket disconnects abruptly (tab close, network drop),
//   all rooms it was in receive 'session-ended' so both sides clean up.
//   'hang-up' is kept for intentional disconnection (End button).

import { Server, Socket } from 'socket.io';
import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`[+] ${socket.id} connected`);

    // ── 1. Join room ────────────────────────────────────────────────────────
    socket.on('join-room', (roomId: string) => {
      if (!isValidRoomId(roomId)) {
        socket.emit('error', 'Invalid room ID');
        return;
      }

      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size >= 2) {
        socket.emit('room-full');
        console.log(`[room] ${roomId} is full — rejected ${socket.id}`);
        return;
      }

      socket.join(roomId);
      // Tell the existing peer (host) a new viewer has joined
      socket.to(roomId).emit('user-connected', socket.id);
      console.log(`[room] ${socket.id} joined ${roomId} (size: ${(room?.size ?? 0) + 1})`);
    });

    // ── 2. Screen-share offer (host → viewer) ───────────────────────────────
    socket.on('call-user', (data: {
      userToCall: string;
      from: string;
      signalData: RTCSessionDescriptionInit;
    }) => {
      const { userToCall, signalData, from } = data;
      if (!isValidSDP(signalData)) {
        console.warn(`[SDP] invalid offer from ${socket.id}`);
        return;
      }
      io.to(userToCall).emit('incoming-call', { signal: signalData, from });
    });

    // ── 3. AV call offer (either peer → other peer) ─────────────────────────
    // Separate from 'call-user' so viewer can handle it differently
    // (prompt for camera/mic before answering).
    socket.on('av-call-user', (data: {
      userToCall: string;
      from: string;
      signalData: RTCSessionDescriptionInit;
      withVideo: boolean;
    }) => {
      const { userToCall, signalData, from, withVideo } = data;
      if (!isValidSDP(signalData)) {
        console.warn(`[SDP] invalid AV offer from ${socket.id}`);
        return;
      }
      io.to(userToCall).emit('incoming-av-call', {
        signal: signalData,
        from,
        withVideo: !!withVideo,
      });
    });

    // ── 4. Answer (viewer → host, or either peer for renegotiation) ─────────
    socket.on('answer-call', (data: {
      to: string;
      signal: RTCSessionDescriptionInit;
    }) => {
      const { to, signal } = data;
      if (!isValidSDP(signal)) {
        console.warn(`[SDP] invalid answer from ${socket.id}`);
        return;
      }
      io.to(to).emit('call-accepted', { signal });
    });

    // ── 5. ICE candidates ───────────────────────────────────────────────────
    socket.on('ice-candidate', (data: {
      target: string;
      candidate: RTCIceCandidateInit;
    }) => {
      const { target, candidate } = data;
      if (!isValidCandidate(candidate)) return;
      io.to(target).emit('ice-candidate', { candidate, from: socket.id });
    });

    // ── 6. [ACCEPT] Host acknowledges viewer's join — tells viewer to wait ──
    socket.on('viewer-pending-ack', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[accept] pending ack: ${socket.id} → ${data.to}`);
      io.to(data.to).emit('waiting-for-host');
    });

    // ── 7. [ACCEPT] Host accepted the connection ────────────────────────────
    socket.on('connection-accepted', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[accept] accepted: ${socket.id} → ${data.to}`);
      io.to(data.to).emit('connection-accepted');
    });

    // ── 8. [ACCEPT] Host rejected the connection ────────────────────────────
    socket.on('connection-rejected', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[accept] rejected: ${socket.id} → ${data.to}`);
      io.to(data.to).emit('connection-rejected');
    });

    // ── 9. Intentional hang-up (End button pressed) ─────────────────────────
    socket.on('hang-up', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[hangup] ${socket.id} → ${data.to}`);
      io.to(data.to).emit('session-ended');
    });

    // ── 10. [CLIPBOARD] Fallback relay when DataChannel isn't open yet ──────
    socket.on('clipboard-sync', (data: { to: string; text: string }) => {
      if (!data?.to || typeof data.text !== 'string') return;
      if (data.text.length > 65536) return; // 64 KB max
      io.to(data.to).emit('clipboard-sync', { text: data.text, from: socket.id });
    });

    // ── 11. Abrupt disconnect — notify all room-mates ──────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`[-] ${socket.id} disconnected (${reason})`);
      // Notify all peers in the same rooms so their sessions clean up
      socket.rooms.forEach((roomId) => {
        socket.to(roomId).emit('session-ended');
      });
    });
  });
};