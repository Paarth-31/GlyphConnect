import { Server, Socket } from 'socket.io';
import { isValidRoomId, isValidSDP, isValidCandidate } from './validators';

export const setupSocketEvents = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`[+] ${socket.id} connected`);

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
      socket.to(roomId).emit('user-connected', socket.id);
      console.log(`[room] ${socket.id} joined ${roomId} (size: ${(room?.size ?? 0) + 1})`);
    });

    socket.on('call-user', (data: {
      userToCall: string;
      from: string;
      signalData: any;
    }) => {
      const { userToCall, signalData, from } = data;
      if (!isValidSDP(signalData)) {
        console.warn(`[SDP] invalid offer from ${socket.id}`);
        return;
      }
      io.to(userToCall).emit('incoming-call', { signal: signalData, from });
    });

    socket.on('av-call-user', (data: {
      userToCall: string;
      from: string;
      signalData: any;
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

    socket.on('answer-call', (data: {
      to: string;
      signal: any;
    }) => {
      const { to, signal } = data;
      if (!isValidSDP(signal)) {
        console.warn(`[SDP] invalid answer from ${socket.id}`);
        return;
      }
      io.to(to).emit('call-accepted', { signal });
    });

    socket.on('ice-candidate', (data: {
      target: string;
      candidate: any;
    }) => {
      const { target, candidate } = data;
      if (!isValidCandidate(candidate)) return;
      io.to(target).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('viewer-pending-ack', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[accept] pending ack: ${socket.id} → ${data.to}`);
      io.to(data.to).emit('waiting-for-host');
    });

    socket.on('connection-accepted', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[accept] accepted: ${socket.id} → ${data.to}`);
      io.to(data.to).emit('connection-accepted');
    });

    socket.on('connection-rejected', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[accept] rejected: ${socket.id} → ${data.to}`);
      io.to(data.to).emit('connection-rejected');
    });

    socket.on('hang-up', (data: { to: string }) => {
      if (!data?.to) return;
      console.log(`[hangup] ${socket.id} → ${data.to}`);
      io.to(data.to).emit('session-ended');
    });

    socket.on('clipboard-sync', (data: { to: string; text: string }) => {
      if (!data?.to || typeof data.text !== 'string') return;
      if (data.text.length > 65536) return;
      io.to(data.to).emit('clipboard-sync', { text: data.text, from: socket.id });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[-] ${socket.id} disconnected (${reason})`);
      socket.rooms.forEach((roomId) => {
        socket.to(roomId).emit('session-ended');
      });
    });
  });
};