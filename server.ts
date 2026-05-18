import { createServer } from "node:http";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3004", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 인메모리 캔버스 상태 캐시 (빠른 초기 로드)
let canvasState: { canvas_json: string; overlay_data: string } | null = null;

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 10e6, // 10MB (base64 이미지 포함)
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // 접속 시 현재 캔버스 상태 전송
    if (canvasState) {
      socket.emit("canvas:state", canvasState);
    }

    socket.on("object:added", (data) => {
      socket.broadcast.emit("object:added", data);
    });

    socket.on("object:modified", (data) => {
      socket.broadcast.emit("object:modified", data);
    });

    socket.on("object:removed", (data) => {
      socket.broadcast.emit("object:removed", data);
    });

    socket.on("drawing:path", (data) => {
      socket.broadcast.emit("drawing:path", data);
    });

    socket.on("table:update", (data) => {
      socket.broadcast.emit("table:update", data);
    });

    socket.on("table:added", (data) => {
      socket.broadcast.emit("table:added", data);
    });

    socket.on("table:removed", (data) => {
      socket.broadcast.emit("table:removed", data);
    });

    // 전체 캔버스 상태 동기화 (저장 시)
    socket.on("canvas:sync", (data) => {
      canvasState = data;
      socket.broadcast.emit("canvas:state", data);
    });

    // 전체삭제
    socket.on("canvas:clear", () => {
      canvasState = null;
      socket.broadcast.emit("canvas:clear");
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
