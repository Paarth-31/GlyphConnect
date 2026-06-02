// // // // signaling-server/src/events.ts
// // // import { Server, Socket } from 'socket.io';
// // // import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

// // // export const setupSocketEvents = (io: Server) => {
// // //   io.on('connection', (socket: Socket) => {
// // //     console.log(`User connected: ${socket.id}`);

// // //     // 1. Join Room
// // //     socket.on('join-room', (roomId: string) => {
// // //       if (!isValidRoomId(roomId)) {
// // //         socket.emit('error', 'Invalid room ID');
// // //         return;
// // //       }
// // //       const room = io.sockets.adapter.rooms.get(roomId);
// // //       if (room && room.size >= 2) {
// // //         socket.emit('error', 'Room is full (max 2 peers)');
// // //         return;
// // //       }
// // //       socket.join(roomId);
// // //       socket.to(roomId).emit('user-connected', socket.id);
// // //       console.log(`User ${socket.id} joined room ${roomId}`);
// // //     });

// // //     // 2. Relay offer (initiator → receiver)
// // //     socket.on('call-user', (data) => {
// // //       const { userToCall, signalData, from } = data;
// // //       if (!isValidSDP(signalData)) {
// // //         console.warn(`Invalid SDP from ${socket.id}`);
// // //         return;
// // //       }
// // //       io.to(userToCall).emit('incoming-call', { signal: signalData, from });
// // //     });

// // //     // 3. Relay answer (receiver → initiator)
// // //     socket.on('answer-call', (data) => {
// // //       const { to, signal } = data;
// // //       if (!isValidSDP(signal)) {
// // //         console.warn(`Invalid answer SDP from ${socket.id}`);
// // //         return;
// // //       }
// // //       io.to(to).emit('call-accepted', { signal });
// // //     });

// // //     // 4. Relay ICE candidates
// // //     socket.on('ice-candidate', (data) => {
// // //       const { target, candidate } = data;
// // //       if (!isValidCandidate(candidate)) return;
// // //       io.to(target).emit('ice-candidate', { candidate, from: socket.id });
// // //     });

// // //     // 5. Disconnect
// // //     socket.on('disconnect', () => {
// // //       console.log(`User disconnected: ${socket.id}`);
// // //     });
// // //   });
// // // };



// // // signaling-server/src/events.ts
// // //
// // // FIX [E]: Added 'hang-up' relay event.
// // // When one peer ends the session it emits 'hang-up' with { to: remoteSocketId }.
// // // The server relays it to the target socket so that peer can tear down its side.
// // // Without this the remote peer's UI stays frozen in "Connected" state even after
// // // the other person has left.

// // import { Server, Socket } from 'socket.io';
// // import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

// // export const setupSocketEvents = (io: Server) => {
// //   io.on('connection', (socket: Socket) => {
// //     console.log(`User connected: ${socket.id}`);

// //     // 1. Join Room
// //     socket.on('join-room', (roomId: string) => {
// //       if (!isValidRoomId(roomId)) {
// //         socket.emit('error', 'Invalid room ID');
// //         return;
// //       }
// //       const room = io.sockets.adapter.rooms.get(roomId);
// //       if (room && room.size >= 2) {
// //         socket.emit('error', 'Room is full (max 2 peers)');
// //         return;
// //       }
// //       socket.join(roomId);
// //       socket.to(roomId).emit('user-connected', socket.id);
// //       console.log(`User ${socket.id} joined room ${roomId}`);
// //     });

// //     // 2. Relay offer (initiator → receiver)
// //     socket.on('call-user', (data) => {
// //       const { userToCall, signalData, from } = data;
// //       if (!isValidSDP(signalData)) {
// //         console.warn(`Invalid SDP from ${socket.id}`);
// //         return;
// //       }
// //       io.to(userToCall).emit('incoming-call', { signal: signalData, from });
// //     });

// //     // 3. Relay answer (receiver → initiator)
// //     socket.on('answer-call', (data) => {
// //       const { to, signal } = data;
// //       if (!isValidSDP(signal)) {
// //         console.warn(`Invalid answer SDP from ${socket.id}`);
// //         return;
// //       }
// //       io.to(to).emit('call-accepted', { signal });
// //     });

// //     // 4. Relay ICE candidates
// //     socket.on('ice-candidate', (data) => {
// //       const { target, candidate } = data;
// //       if (!isValidCandidate(candidate)) return;
// //       io.to(target).emit('ice-candidate', { candidate, from: socket.id });
// //     });

// //     // 5. [FIX E] Relay hang-up — one peer ended the session, notify the other
// //     socket.on('hang-up', (data: { to: string }) => {
// //       if (!data?.to) return;
// //       console.log(`Hang-up from ${socket.id} to ${data.to}`);
// //       io.to(data.to).emit('hang-up');
// //     });

// //     // 6. Disconnect — also emit hang-up to all peers in the same rooms
// //     // so if the browser tab closes abruptly, the remote side still gets notified
// //     socket.on('disconnect', () => {
// //       console.log(`User disconnected: ${socket.id}`);
// //       // Find every room this socket was in and notify the remaining peer
// //       socket.rooms.forEach((roomId) => {
// //         socket.to(roomId).emit('hang-up');
// //       });
// //     });
// //   });
// // };




// // signaling-server/src/events.ts
// //
// // FIXES:
// // [FIX 5] 'hang-up' relay: when one peer ends the session, the server forwards
// //         the signal to the other peer so both sides clean up together.
// //
// // [FIX 5] 'disconnect' notification: if a user closes the browser tab / loses
// //         connection, remaining peers in the room receive 'hang-up' automatically
// //         so they're not left in a stale "Connected" state.

// import { Server, Socket } from 'socket.io';
// import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

// export const setupSocketEvents = (io: Server) => {
//   io.on('connection', (socket: Socket) => {
//     console.log(`User connected: ${socket.id}`);

//     // 1. Join room — max 2 peers per room
//     socket.on('join-room', (roomId: string) => {
//       if (!isValidRoomId(roomId)) { socket.emit('error', 'Invalid room ID'); return; }

//       const room = io.sockets.adapter.rooms.get(roomId);
//       if (room && room.size >= 2) { socket.emit('error', 'Room is full (max 2 peers)'); return; }

//       socket.join(roomId);
//       socket.to(roomId).emit('user-connected', socket.id);
//       console.log(`${socket.id} joined room ${roomId} (size: ${(room?.size ?? 0) + 1})`);
//     });

//     // 2. Relay offer (initiator → receiver)
//     socket.on('call-user', (data) => {
//       const { userToCall, signalData, from } = data;
//       if (!isValidSDP(signalData)) { console.warn(`Invalid SDP from ${socket.id}`); return; }
//       io.to(userToCall).emit('incoming-call', { signal: signalData, from });
//     });

//     // 3. Relay answer (receiver → initiator)
//     socket.on('answer-call', (data) => {
//       const { to, signal } = data;
//       if (!isValidSDP(signal)) { console.warn(`Invalid answer SDP from ${socket.id}`); return; }
//       io.to(to).emit('call-accepted', { signal });
//     });

//     // 4. Relay ICE candidates
//     socket.on('ice-candidate', (data) => {
//       const { target, candidate } = data;
//       if (!isValidCandidate(candidate)) return;
//       io.to(target).emit('ice-candidate', { candidate, from: socket.id });
//     });

//     // 5. [FIX 5] Relay hang-up — intentional session end by one peer
//     socket.on('hang-up', (data: { to: string }) => {
//       if (!data?.to) return;
//       console.log(`Hang-up: ${socket.id} → ${data.to}`);
//       io.to(data.to).emit('hang-up');
//     });

//     // 6. [FIX 5] Abrupt disconnect — notify all rooms this socket was in
//     socket.on('disconnect', () => {
//       console.log(`User disconnected: ${socket.id}`);
//       socket.rooms.forEach(roomId => {
//         // socket.rooms still contains the IDs at this point
//         socket.to(roomId).emit('hang-up');
//       });
//     });
//   });
// };





// signaling-server/src/events.ts
//
// [FIX 2] Added 'av-call-user' relay event.
//   When a caller starts an audio/video call they emit 'av-call-user' (instead
//   of the generic 'call-user') so the server can forward it to the remote peer
//   as 'incoming-av-call' with the withVideo flag. The remote peer's hook
//   listens for 'incoming-av-call', auto-captures their media, and answers —
//   making BOTH sides visible in the call.
//
// [FIX 3] 'hang-up' relay: when one peer ends the session the other is
//   notified so both return to the home screen.
//
// [FIX 3] 'disconnect' notification: abrupt tab-close / network drop also
//   sends hang-up to remaining peers.

import { Server, Socket } from 'socket.io';
import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    // 1. Join room — max 2 peers per room
    socket.on('join-room', (roomId: string) => {
      if (!isValidRoomId(roomId)) { socket.emit('error', 'Invalid room ID'); return; }
      const room = io.sockets.adapter.rooms.get(roomId);
      if (room && room.size >= 2) { socket.emit('error', 'Room is full (max 2 peers)'); return; }
      socket.join(roomId);
      socket.to(roomId).emit('user-connected', socket.id);
      console.log(`${socket.id} joined room ${roomId} (size: ${(room?.size ?? 0) + 1})`);
    });

    // 2. Relay screen-share offer (initiator → receiver)
    socket.on('call-user', (data) => {
      const { userToCall, signalData, from } = data;
      if (!isValidSDP(signalData)) { console.warn(`Invalid SDP from ${socket.id}`); return; }
      io.to(userToCall).emit('incoming-call', { signal: signalData, from });
    });

    // [FIX 2] 3. Relay AV call offer — includes withVideo flag so receiver
    //   knows whether to capture video or audio-only.
    socket.on('av-call-user', (data) => {
      const { userToCall, signalData, from, withVideo } = data;
      if (!isValidSDP(signalData)) { console.warn(`Invalid AV SDP from ${socket.id}`); return; }
      console.log(`AV call from ${socket.id} → ${userToCall} (video: ${withVideo})`);
      io.to(userToCall).emit('incoming-av-call', { signal: signalData, from, withVideo });
    });

    // 4. Relay answer (receiver → initiator)
    socket.on('answer-call', (data) => {
      const { to, signal } = data;
      if (!isValidSDP(signal)) { console.warn(`Invalid answer SDP from ${socket.id}`); return; }
      io.to(to).emit('call-accepted', { signal });
    });

    // 5. Relay ICE candidates
    socket.on('ice-candidate', (data) => {
      const { target, candidate } = data;
      if (!isValidCandidate(candidate)) return;
      io.to(target).emit('ice-candidate', { candidate, from: socket.id });
    });

    // [FIX 3] 6. Relay hang-up — intentional session end
    socket.on('hang-up', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`Hang-up: ${socket.id} → ${data.to}`);
      io.to(data.to).emit('hang-up');
    });

    // [FIX 3] 7. Abrupt disconnect — notify remaining peers in all rooms
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      socket.rooms.forEach(roomId => {
        socket.to(roomId).emit('hang-up');
      });
    });
  });
};
